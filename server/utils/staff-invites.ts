import { exec, one, q } from './db'
import { newId } from './ids'

/** A week is long enough to notice and short enough that a stale offer expires. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Owner is never offered.
 *
 * Stepping somebody up to the top of the ladder is rare and irreversible enough
 * that it stays a deliberate act on the database, not something that happens
 * because an invitation was accepted on a phone.
 */
export const INVITABLE_ROLES = ['moderator', 'admin'] as const
export type InvitableRole = typeof INVITABLE_ROLES[number]

export function isInvitableRole(value: unknown): value is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(String(value))
}

export interface InviteRow {
  id: string
  user_id: string
  role: string
  invited_by: string | null
  inviter: string
  status: string
  created: string | number
  expires: string | number
  answered: string | number | null
}

const COLUMNS = 'id, user_id, role, invited_by, inviter, status, created, expires, answered'

const num = (value: string | number | null) => (value === null ? null : Number(value))

export function publicInvite(row: InviteRow) {
  return {
    id: row.id,
    role: row.role,
    inviter: row.inviter,
    created: Number(row.created),
    expires: Number(row.expires),
  }
}

/** The offer this account has open, if it still stands. */
export async function pendingInviteFor(userId: string): Promise<InviteRow | undefined> {
  // sql-safe: COLUMNS is a constant column list
  return await one<InviteRow>(
    `SELECT ${COLUMNS} FROM staff_invite
     WHERE user_id = $1 AND status = 'pending' AND expires > $2`,
    [userId, Date.now()],
  )
}

export async function inviteById(id: string): Promise<InviteRow | undefined> {
  // sql-safe: COLUMNS is a constant column list
  return await one<InviteRow>(`SELECT ${COLUMNS} FROM staff_invite WHERE id = $1`, [id])
}

export interface InviteListRow extends InviteRow {
  username: string | null
  email: string | null
  image: string | null
  current_role: string | null
}

export async function listInvites(limit = 50): Promise<InviteListRow[]> {
  return await q<InviteListRow>(
    `SELECT i.id, i.user_id, i.role, i.invited_by, i.inviter, i.status,
            i.created, i.expires, i.answered,
            u.username, u.email, u.image, u.role AS current_role
     FROM staff_invite i
     LEFT JOIN "user" u ON u.id = i.user_id
     ORDER BY (i.status = 'pending') DESC, i.created DESC
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 200)],
  )
}

export interface Inviter {
  id: string
  username?: string | null
  name?: string | null
}

/**
 * Offer somebody a place on the team.
 *
 * Refuses to offer what the account already has, and refuses to touch anybody
 * already standing at or above the offered rung — an invitation is a way in,
 * never a way to quietly demote somebody.
 */
export async function createInvite(
  target: { id: string, role: string | null },
  role: InvitableRole,
  by: Inviter,
): Promise<InviteRow> {
  if (target.id === by.id) {
    throw createError({ statusCode: 400, statusMessage: 'you cannot invite yourself' })
  }

  if (staffRank(target) >= staffRank({ role })) {
    throw createError({ statusCode: 409, statusMessage: 'that account already has this or more' })
  }

  // An unanswered offer is replaced rather than stacked, so the unique index
  // holds and the person is never asked the same question twice.
  await exec(
    `UPDATE staff_invite SET status = 'revoked', answered = $2
     WHERE user_id = $1 AND status = 'pending'`,
    [target.id, Date.now()],
  )

  const now = Date.now()

  // sql-safe: COLUMNS is a constant column list
  return (await one<InviteRow>(
    `INSERT INTO staff_invite (id, user_id, role, invited_by, inviter, status, created, expires)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
     RETURNING ${COLUMNS}`,
    [newId(), target.id, role, by.id, String(by.username || by.name || ''), now, now + INVITE_TTL_MS],
  ))!
}

/**
 * Take the offer.
 *
 * The role is written in the same statement that closes the invitation, and the
 * invitation is only closed if it was still open — so a request replayed twice
 * cannot grant anything a second time, and the role always comes from the row
 * rather than from whatever the browser sent.
 */
export async function acceptInvite(userId: string): Promise<string | null> {
  const claimed = await one<{ id: string, role: string }>(
    `UPDATE staff_invite SET status = 'accepted', answered = $2
     WHERE user_id = $1 AND status = 'pending' AND expires > $2
     RETURNING id, role`,
    [userId, Date.now()],
  )
  if (!claimed) return null

  if (!isInvitableRole(claimed.role)) return null

  await exec('UPDATE "user" SET role = $1 WHERE id = $2', [claimed.role, userId])
  return claimed.role
}

export async function declineInvite(userId: string): Promise<boolean> {
  const row = await one<{ id: string }>(
    `UPDATE staff_invite SET status = 'declined', answered = $2
     WHERE user_id = $1 AND status = 'pending'
     RETURNING id`,
    [userId, Date.now()],
  )
  return Boolean(row)
}

export async function revokeInvite(id: string): Promise<InviteRow | undefined> {
  // sql-safe: COLUMNS is a constant column list
  return await one<InviteRow>(
    `UPDATE staff_invite SET status = 'revoked', answered = $2
     WHERE id = $1 AND status = 'pending'
     RETURNING ${COLUMNS}`,
    [id, Date.now()],
  )
}
