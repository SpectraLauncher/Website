
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import type { H3Event } from 'h3'
import { exec, one, q } from './db'
import { newId } from './ids'
import {
  ALL_TOKEN_SCOPES,
  TOKEN_BYTES,
  TOKEN_PREFIX,
  type TokenScope,
  expandImplied,
  expiryFrom,
  hasScope,
  lifetimeDays,
  maskToScopes,
  scopesToMask,
} from '../../shared/utils/token-scopes'

export interface TokenRow {
  id: string
  user_id: string
  name: string
  hint: string
  token_hash: string
  scopes: string | number
  expires: string | number | null
  last_used: string | number | null
  created: string | number
}

const COLUMNS = 'id, user_id, name, hint, token_hash, scopes, expires, last_used, created'

// The token is stored as a hash, exactly like a password, because a database
// dump must not hand over live credentials. It is shown once and never again.
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface CreatedToken {
  row: TokenRow
  token: string
}

export async function createToken(input: {
  userId: string
  name: string
  scopes: unknown
  expiresInDays?: number | null
}): Promise<CreatedToken> {
  const name = String(input.name ?? '').trim().slice(0, 80) || 'token'

  const mask = expandImplied(scopesToMask(input.scopes)) & ALL_TOKEN_SCOPES
  if (!mask) throw createError({ statusCode: 400, statusMessage: 'pick at least one scope' })

  const secret = randomBytes(TOKEN_BYTES).toString('base64url')
  const token = `${TOKEN_PREFIX}${secret}`

  const expires = expiryFrom(lifetimeDays(input.expiresInDays))

  // sql-safe: COLUMNS is a constant column list
  const row = await one<TokenRow>(
    `INSERT INTO access_token (id, user_id, name, hint, token_hash, scopes, expires, created)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${COLUMNS}`,
    [
      newId(),
      input.userId,
      name,
      // Enough to recognise which token this is in a list, useless on its own.
      secret.slice(-6),
      hashToken(token),
      mask,
      expires,
      Date.now(),
    ],
  )

  return { row: row!, token }
}

export async function tokensOf(userId: string): Promise<TokenRow[]> {
  // sql-safe: COLUMNS is a constant column list
  return await q<TokenRow>(
    `SELECT ${COLUMNS} FROM access_token WHERE user_id = $1 ORDER BY created DESC`,
    [userId],
  )
}

export async function revokeToken(userId: string, id: string): Promise<boolean> {
  const gone = await exec('DELETE FROM access_token WHERE id = $1 AND user_id = $2', [id, userId])
  return gone > 0
}

export interface TokenBearer {
  userId: string
  scopes: number
  tokenId: string
}

// Looked up by hash, and the hash comparison is still done in constant time:
// the lookup is by equality in Postgres, but the final check should not leak
// timing on a partial match.
export async function bearerFromToken(token: string): Promise<TokenBearer | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null

  const digest = hashToken(token)
  const row = await one<TokenRow>(
    // sql-safe: COLUMNS is a constant column list
    `SELECT ${COLUMNS} FROM access_token WHERE token_hash = $1`,
    [digest],
  )
  if (!row) return null

  const stored = Buffer.from(row.token_hash, 'hex')
  const given = Buffer.from(digest, 'hex')
  if (stored.length !== given.length || !timingSafeEqual(stored, given)) return null

  if (row.expires !== null && Number(row.expires) < Date.now()) {
    return null
  }

  // Written without awaiting: a token that works must not be slowed down by
  // bookkeeping, and losing one timestamp costs nothing.
  exec('UPDATE access_token SET last_used = $2 WHERE id = $1', [row.id, Date.now()])
    .catch(e => console.error('[token] last_used', e))

  return { userId: row.user_id, scopes: Number(row.scopes), tokenId: row.id }
}

export function publicToken(row: TokenRow) {
  return {
    id: row.id,
    name: row.name,
    hint: row.hint,
    scopes: maskToScopes(Number(row.scopes)),
    expires: row.expires === null ? null : Number(row.expires),
    lastUsed: row.last_used === null ? null : Number(row.last_used),
    created: Number(row.created),
  }
}

export function tokenFromEvent(event: H3Event): string | null {
  const header = getHeader(event, 'authorization') ?? ''
  const [scheme, value] = header.split(' ')
  if (!value || scheme?.toLowerCase() !== 'bearer') return null
  return value.startsWith(TOKEN_PREFIX) ? value : null
}

export async function requireScope(event: H3Event, scope: TokenScope) {
  const raw = tokenFromEvent(event)

  // No token means a normal session, which carries the account's full rights.
  // A token has to have been given this scope explicitly.
  if (!raw) return await requireUser(event)

  const bearer = await bearerFromToken(raw)
  if (!bearer) throw createError({ statusCode: 401, statusMessage: 'bad token' })

  if (!hasScope(bearer.scopes, scope)) {
    throw createError({ statusCode: 403, statusMessage: `token lacks ${scope}` })
  }

  const user = await one<{ id: string, banned: boolean | null, role: string | null }>(
    'SELECT id, banned, role FROM "user" WHERE id = $1', [bearer.userId])

  if (!user) throw createError({ statusCode: 401, statusMessage: 'bad token' })
  if (user.banned) throw createError({ statusCode: 403, statusMessage: 'account suspended' })

  return user
}
