
import { q, exec } from './db'
import { useR2, r2Delete, UPLOAD_URL_TTL } from './r2'

export const TTL_DAYS = 7

export const MAX_PACK_BYTES = 1024 * 1024 * 1024

export const MAX_INLINE_BYTES = 100 * 1024 * 1024

export const EXTEND_WINDOW_MS = 48 * 60 * 60 * 1000

export function expiryFor(now: number): number {
  return now + TTL_DAYS * 86_400_000
}

const HISTORY_DAYS = 90

export async function pruneShares(): Promise<number> {
  const now = Date.now()
  const r2 = useR2()
  let freed = 0

  const stale = await q<{ code: string, object_key: string }>(
    'SELECT code, object_key FROM shares WHERE expires < $1 AND object_key IS NOT NULL',
    [now],
  )
  for (const row of stale) {
    if (r2 && !(await r2Delete(r2, row.object_key))) continue
    await exec('UPDATE shares SET object_key = NULL WHERE code = $1', [row.code])
    freed++
  }

  const abandoned = await q<{ code: string, pending_key: string }>(
    'SELECT code, pending_key FROM shares WHERE pending_key IS NOT NULL AND pending_at < $1',
    [now - UPLOAD_URL_TTL * 1000],
  )
  for (const row of abandoned) {
    if (r2 && !(await r2Delete(r2, row.pending_key))) continue
    await exec('UPDATE shares SET pending_key = NULL, pending_at = NULL WHERE code = $1', [row.code])
    freed++
  }

  await exec('DELETE FROM shares WHERE created < $1 AND expires < $2',
    [now - HISTORY_DAYS * 86_400_000, now])
  return freed
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LEN = 6

export async function newCode(): Promise<string> {
  const { randomBytes } = await import('node:crypto')
  for (let attempt = 0; attempt < 10; attempt++) {
    const bytes = randomBytes(CODE_LEN)
    let code = ''
    for (const b of bytes) code += ALPHABET[b % ALPHABET.length]
    const taken = await q('SELECT 1 FROM shares WHERE code = $1', [code])
    if (!taken.length) return code
  }
  throw createError({ statusCode: 500, statusMessage: 'could not allocate a code' })
}

export function normalizeCode(raw: unknown): string {
  return String(raw ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-CODE_LEN)
}

export function packKey(code: string, revision: number) {
  return `packs/${code}/${revision}.zip`
}

export type ShareRole = 'owner' | 'collaborator'

export function shareRole(ownerId: string | null, userId: string, canPush: boolean | null | undefined): ShareRole | null {
  if (ownerId && ownerId === userId) return 'owner'
  return canPush ? 'collaborator' : null
}

export const PUSH_BUSY = {
  statusCode: 409,
  statusMessage: 'someone else is pushing this pack right now — try again in a moment',
  data: { reason: 'busy' },
}

interface PushTarget {
  revision: number
  uploaded: boolean
  pending_by: string | null
  pending_at: number | string | null
}

// A push has to start from the revision now live. Anything else would quietly
// drop whatever someone pushed in between, so it is refused and the launcher
// walks the person through the differences before trying again. A launcher
// older than collaboration sends no base; only the owner could push then, so
// only the owner may still push without one.
export function pushRefusal(share: PushTarget, input: {
  role: ShareRole
  userId: string
  base: number | null
  now: number
}): { statusCode: number, statusMessage: string, data: Record<string, unknown> } | null {
  const pendingAt = Number(share.pending_at)
  if (share.pending_by && share.pending_by !== input.userId
    && pendingAt > input.now - UPLOAD_URL_TTL * 1000) {
    return PUSH_BUSY
  }
  if (input.base === null) {
    if (input.role === 'owner') return null
    return { statusCode: 400, statusMessage: 'missing base revision', data: { reason: 'base' } }
  }
  if (share.uploaded && input.base !== share.revision) {
    return {
      statusCode: 409,
      statusMessage: `revision ${share.revision} was pushed since you last updated — get it first`,
      data: { reason: 'stale', revision: share.revision },
    }
  }
  return null
}

export function updateAudience(ownerId: string | null, recipients: string[], pusherId: string): string[] {
  return [...new Set([ownerId, ...recipients])]
    .filter((id): id is string => !!id && id !== pusherId)
}
