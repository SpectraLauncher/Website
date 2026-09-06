
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import type { H3Event } from 'h3'
import { exec, one, q } from './db'
import { newId } from './ids'
import {
  ALL_TOKEN_SCOPES,
  expandImplied,
  scopesToMask,
} from '../../shared/utils/token-scopes'
import { OAUTH_CODE_TTL_MS, OAUTH_TOKEN_TTL_MS, cleanRedirectUris } from '../../shared/utils/oauth'

export interface ClientRow {
  id: string
  owner_id: string
  name: string
  icon: string | null
  secret_hash: string
  redirect_uris: string[]
  max_scopes: string | number
  created: string | number
}

const CLIENT_COLUMNS = 'id, owner_id, name, icon, secret_hash, redirect_uris, max_scopes, created'

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function clientById(id: string): Promise<ClientRow | undefined> {
  // sql-safe: CLIENT_COLUMNS is a constant column list
  return await one<ClientRow>(`SELECT ${CLIENT_COLUMNS} FROM oauth_client WHERE id = $1`, [id])
}

export async function clientsOf(userId: string): Promise<ClientRow[]> {
  // sql-safe: CLIENT_COLUMNS is a constant column list
  return await q<ClientRow>(
    `SELECT ${CLIENT_COLUMNS} FROM oauth_client WHERE owner_id = $1 ORDER BY created DESC`,
    [userId],
  )
}

export interface CreatedClient {
  row: ClientRow
  secret: string
}

export async function createClient(input: {
  ownerId: string
  name: string
  redirectUris: unknown
  scopes: unknown
}): Promise<CreatedClient> {
  const name = String(input.name ?? '').trim().slice(0, 80)
  if (!name) throw createError({ statusCode: 400, statusMessage: 'name is required' })

  const uris = cleanRedirectUris(input.redirectUris)
  if (!uris.length) {
    throw createError({ statusCode: 400, statusMessage: 'add at least one https redirect' })
  }

  // The ceiling on what this client may ever ask for. A request narrower than
  // this is fine; a request wider than it is refused at authorize time.
  const max = expandImplied(scopesToMask(input.scopes)) & ALL_TOKEN_SCOPES
  if (!max) throw createError({ statusCode: 400, statusMessage: 'pick at least one scope' })

  const secret = randomBytes(32).toString('base64url')

  // sql-safe: CLIENT_COLUMNS is a constant column list
  const row = await one<ClientRow>(
    `INSERT INTO oauth_client (id, owner_id, name, secret_hash, redirect_uris, max_scopes, created)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${CLIENT_COLUMNS}`,
    [newId(), input.ownerId, name, hash(secret), uris, max, Date.now()],
  )

  return { row: row!, secret }
}

export async function updateClient(id: string, input: {
  name?: unknown
  redirectUris?: unknown
  scopes?: unknown
}): Promise<ClientRow> {
  const current = await clientById(id)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'no such client' })

  const uris = input.redirectUris === undefined
    ? current.redirect_uris
    : cleanRedirectUris(input.redirectUris)

  if (!uris.length) {
    throw createError({ statusCode: 400, statusMessage: 'add at least one https redirect' })
  }

  const max = input.scopes === undefined
    ? Number(current.max_scopes)
    : expandImplied(scopesToMask(input.scopes)) & ALL_TOKEN_SCOPES

  // sql-safe: CLIENT_COLUMNS is a constant column list
  const row = await one<ClientRow>(
    `UPDATE oauth_client SET name = $2, redirect_uris = $3, max_scopes = $4
     WHERE id = $1 RETURNING ${CLIENT_COLUMNS}`,
    [
      id,
      typeof input.name === 'string' && input.name.trim()
        ? input.name.trim().slice(0, 80)
        : current.name,
      uris,
      max,
    ],
  )
  return row!
}

export function deleteClient(id: string, ownerId: string) {
  return exec('DELETE FROM oauth_client WHERE id = $1 AND owner_id = $2', [id, ownerId])
}

// Rotating the secret is the answer to a leak, and it must not require throwing
// the client away and re-registering every redirect.
export async function rotateSecret(id: string): Promise<string> {
  const secret = randomBytes(32).toString('base64url')
  await exec('UPDATE oauth_client SET secret_hash = $2 WHERE id = $1', [id, hash(secret)])
  return secret
}

export function verifySecret(client: ClientRow, given: string): boolean {
  return constantTimeEqual(client.secret_hash, hash(given))
}

export interface Grant {
  scopes: number
}

export async function grantFor(clientId: string, userId: string): Promise<Grant | null> {
  const row = await one<{ scopes: string | number }>(
    'SELECT scopes FROM oauth_grant WHERE client_id = $1 AND user_id = $2',
    [clientId, userId],
  )
  return row ? { scopes: Number(row.scopes) } : null
}

export function saveGrant(clientId: string, userId: string, scopes: number) {
  return exec(
    `INSERT INTO oauth_grant (client_id, user_id, scopes, created)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (client_id, user_id) DO UPDATE SET scopes = EXCLUDED.scopes`,
    [clientId, userId, scopes, Date.now()],
  )
}

export async function revokeGrant(clientId: string, userId: string) {
  await exec('DELETE FROM oauth_grant WHERE client_id = $1 AND user_id = $2', [clientId, userId])

  // Withdrawing consent has to take the tokens with it, or the application keeps
  // working and the revoke button is a lie.
  await exec('DELETE FROM access_token WHERE client_id = $1 AND user_id = $2', [clientId, userId])
}

export async function grantedClients(userId: string) {
  return await q<{ id: string, name: string, icon: string | null, scopes: string | number, created: string | number }>(
    `SELECT c.id, c.name, c.icon, g.scopes, g.created
     FROM oauth_grant g JOIN oauth_client c ON c.id = g.client_id
     WHERE g.user_id = $1 ORDER BY g.created DESC`,
    [userId],
  )
}

// One use, ten minutes, and bound to the redirect it was issued for. Only the
// hash is stored, for the same reason a token is.
export async function issueCode(input: {
  clientId: string
  userId: string
  scopes: number
  redirectUri: string
}): Promise<string> {
  const code = randomBytes(32).toString('base64url')

  await exec(
    `INSERT INTO oauth_code (code_hash, client_id, user_id, scopes, redirect_uri, expires, created)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      hash(code),
      input.clientId,
      input.userId,
      input.scopes,
      input.redirectUri,
      Date.now() + OAUTH_CODE_TTL_MS,
      Date.now(),
    ],
  )

  return code
}

export interface RedeemedCode {
  userId: string
  scopes: number
}

// Deleting as part of the read is what makes the code single-use: two requests
// racing on the same code cannot both come back with a row.
export async function redeemCode(input: {
  code: string
  clientId: string
  redirectUri: string
}): Promise<RedeemedCode | null> {
  const row = await one<{ user_id: string, scopes: string | number, redirect_uri: string, expires: string | number }>(
    `DELETE FROM oauth_code
     WHERE code_hash = $1 AND client_id = $2
     RETURNING user_id, scopes, redirect_uri, expires`,
    [hash(input.code), input.clientId],
  )

  if (!row) return null
  if (Number(row.expires) < Date.now()) return null
  if (row.redirect_uri !== input.redirectUri) return null

  return { userId: row.user_id, scopes: Number(row.scopes) }
}

export async function issueOAuthToken(input: {
  clientId: string
  userId: string
  scopes: number
}): Promise<{ token: string, expiresIn: number }> {
  const secret = randomBytes(32).toString('base64url')
  const token = `spx_${secret}`

  await exec(
    `INSERT INTO access_token (id, user_id, client_id, name, hint, token_hash, scopes, expires, created)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      newId(),
      input.userId,
      input.clientId,
      'oauth',
      secret.slice(-6),
      createHash('sha256').update(token).digest('hex'),
      input.scopes,
      Date.now() + OAUTH_TOKEN_TTL_MS,
      Date.now(),
    ],
  )

  return { token, expiresIn: Math.floor(OAUTH_TOKEN_TTL_MS / 1000) }
}

export function publicClient(row: ClientRow) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    redirectUris: row.redirect_uris,
    scopes: Number(row.max_scopes),
    created: Number(row.created),
  }
}

export function pruneExpiredCodes() {
  return exec('DELETE FROM oauth_code WHERE expires < $1', [Date.now()])
}

// Somebody else's client answers 404 rather than 403, so the id space cannot be
// walked to find out which clients exist.
export async function requireOwnClient(event: H3Event): Promise<ClientRow> {
  const user = await requireUser(event)
  const client = await clientById(String(getRouterParam(event, 'id') ?? ''))

  if (!client || client.owner_id !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'no such client' })
  }
  return client
}
