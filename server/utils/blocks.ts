
import { exec, one, q } from './db'

// Blocking is one-directional and private: the blocked person is never told,
// because telling them turns a quiet exit into an argument.
export async function blockUser(userId: string, targetId: string): Promise<void> {
  if (userId === targetId) {
    throw createError({ statusCode: 400, statusMessage: 'you cannot block yourself' })
  }

  await exec(
    `INSERT INTO user_block (user_id, blocked_id, created)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [userId, targetId, Date.now()],
  )

  // A block that leaves the friendship standing is not a block.
  await exec(
    `DELETE FROM friendship
     WHERE (requester_id = $1 AND addressee_id = $2)
        OR (requester_id = $2 AND addressee_id = $1)`,
    [userId, targetId],
  )
}

export function unblockUser(userId: string, targetId: string) {
  return exec('DELETE FROM user_block WHERE user_id = $1 AND blocked_id = $2', [userId, targetId])
}

export async function blockedIds(userId: string): Promise<string[]> {
  const rows = await q<{ blocked_id: string }>(
    'SELECT blocked_id FROM user_block WHERE user_id = $1', [userId])
  return rows.map(row => row.blocked_id)
}

export async function blockedList(userId: string) {
  return await q<{ id: string, username: string | null, name: string | null, image: string | null, created: string | number }>(
    `SELECT u.id, u.username, u.name, u.image, b.created
     FROM user_block b JOIN "user" u ON u.id = b.blocked_id
     WHERE b.user_id = $1 ORDER BY b.created DESC`,
    [userId],
  )
}

// True if either side has blocked the other. Used to refuse an interaction
// rather than to hide content, so it has to look both ways: someone I blocked
// must not be able to reach me either.
export async function eitherBlocked(a: string, b: string): Promise<boolean> {
  const row = await one<{ user_id: string }>(
    `SELECT user_id FROM user_block
     WHERE (user_id = $1 AND blocked_id = $2) OR (user_id = $2 AND blocked_id = $1)
     LIMIT 1`,
    [a, b],
  )
  return Boolean(row)
}

export async function isBlockedBy(viewerId: string, authorId: string): Promise<boolean> {
  const row = await one<{ user_id: string }>(
    'SELECT user_id FROM user_block WHERE user_id = $1 AND blocked_id = $2',
    [viewerId, authorId],
  )
  return Boolean(row)
}
