import { exec, one, q } from './db'

export async function reactionsFor(postId: string, userId?: string | null): Promise<ReactionState> {
  const rows = await q<{ kind: string, n: number }>(
    'SELECT kind, count(*)::int AS n FROM post_reaction WHERE post_id = $1 GROUP BY kind',
    [postId],
  )

  const mine = userId
    ? (await q<{ kind: string }>(
        'SELECT kind FROM post_reaction WHERE post_id = $1 AND user_id = $2', [postId, userId]))
        .map(row => row.kind).filter(isReaction)
    : []

  return { counts: reactionTally(rows), mine }
}

/**
 * Add the reaction, or take it back.
 *
 * The delete answers whether there was one, so the insert only runs when there
 * was not — one round trip each way, and two clicks racing each other end with
 * the row either present or absent rather than with an error.
 */
export async function toggleReaction(
  postId: string,
  userId: string,
  kind: ReactionId,
): Promise<boolean> {
  const removed = await one<{ kind: string }>(
    'DELETE FROM post_reaction WHERE post_id = $1 AND user_id = $2 AND kind = $3 RETURNING kind',
    [postId, userId, kind],
  )
  if (removed) return false

  await exec(
    `INSERT INTO post_reaction (post_id, user_id, kind, created)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [postId, userId, kind, Date.now()],
  )

  return true
}
