
import { q, usePool } from './db'

export const SHARE_TOTAL = 10_000

export interface OrgShare {
  userId: string
  shareBps: number
}

export async function splitFor(orgId: string): Promise<OrgShare[]> {
  const rows = await q<{ user_id: string, share_bps: number }>(
    'SELECT user_id, share_bps FROM org_split WHERE org_id = $1 ORDER BY user_id',
    [orgId],
  )

  return rows.map(row => ({ userId: row.user_id, shareBps: Number(row.share_bps) }))
}

// Members with the names the page needs, and whether each one can actually be
// paid yet. Somebody without a connected account still gets their share - it
// waits as pending - but the page should say so rather than let a team discover
// it after the fact.
export async function splitMembers(orgId: string) {
  return await q<{
    user_id: string
    username: string | null
    name: string | null
    image: string | null
    role: string
    can_receive: boolean
  }>(
    `SELECT m."userId" AS user_id, u.username, u.name, u.image, m.role,
            COALESCE(a.transfers_enabled, FALSE) AS can_receive
     FROM member m
     JOIN "user" u ON u.id = m."userId"
     LEFT JOIN connected_account a ON a.user_id = m."userId"
     WHERE m."organizationId" = $1
     ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.username`,
    [orgId],
  )
}

// Shares are stored as basis points and have to add up exactly. Anything else
// is refused rather than normalised: a team that meant 30/30/30 should be told
// the tenth is missing, not have it silently handed to somebody.
export function readShares(input: unknown): OrgShare[] {
  const rows = Array.isArray(input) ? input : []

  const shares: OrgShare[] = []
  for (const row of rows) {
    const record = (row ?? {}) as Record<string, unknown>
    const userId = String(record.userId ?? '').trim()
    const shareBps = Math.floor(Number(record.shareBps))

    if (!userId || !Number.isFinite(shareBps) || shareBps < 0 || shareBps > SHARE_TOTAL) {
      throw createError({ statusCode: 400, statusMessage: 'a share is out of range' })
    }
    if (shares.some(share => share.userId === userId)) {
      throw createError({ statusCode: 400, statusMessage: 'a member appears twice' })
    }

    if (shareBps > 0) shares.push({ userId, shareBps })
  }

  const total = shares.reduce((sum, share) => sum + share.shareBps, 0)

  // An empty split is allowed and means "no arrangement": payment then falls
  // back to the organization's owners.
  if (shares.length && total !== SHARE_TOTAL) {
    throw createError({ statusCode: 400, statusMessage: 'shares have to add up to 100%' })
  }

  return shares
}

// Replaced wholesale in one transaction. A split that is briefly half-written is
// a split that could pay somebody the wrong amount if a sale landed in between.
export async function saveSplit(orgId: string, input: unknown): Promise<void> {
  const shares = readShares(input)

  const members = await splitMembers(orgId)
  const known = new Set(members.map(member => member.user_id))

  for (const share of shares) {
    if (!known.has(share.userId)) {
      throw createError({ statusCode: 400, statusMessage: 'that person is not a member' })
    }
  }

  const client = await usePool().connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM org_split WHERE org_id = $1', [orgId])

    for (const share of shares) {
      await client.query(
        `INSERT INTO org_split (org_id, user_id, share_bps, updated)
         VALUES ($1, $2, $3, $4)`,
        [orgId, share.userId, share.shareBps, Date.now()],
      )
    }

    await client.query('COMMIT')
  }
  catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  }
  finally {
    client.release()
  }
}
