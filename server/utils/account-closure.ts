
import { exec, one, q } from './db'
import { queueSweep } from './images'

export interface ClosureBlocker {
  code: string
  detail: string
}

// Reasons an account cannot simply vanish. Each one is something that would
// leave other people holding a broken thing, not a reason to keep the person.
export async function closureBlockers(userId: string): Promise<ClosureBlocker[]> {
  const blockers: ClosureBlocker[] = []

  // A sole owner walking out leaves projects nobody can administer. The same
  // rule the leave endpoint enforces, asked before the fact.
  const orphanedOrgs = await q<{ name: string }>(
    `SELECT o.name FROM member m
     JOIN organization o ON o.id = m."organizationId"
     WHERE m."userId" = $1 AND m.role = 'owner'
       AND (SELECT count(*) FROM member m2
            WHERE m2."organizationId" = m."organizationId" AND m2.role = 'owner') = 1`,
    [userId],
  )

  for (const org of orphanedOrgs) {
    blockers.push({ code: 'sole_owner', detail: org.name })
  }

  // A sales blocker belongs here too — money taken has to stay attributable for
  // refunds and books — and comes back with the order model.

  return blockers
}

// Deletion, not anonymisation. The cascades on "user" take the sessions,
// tokens, notifications, collections, comments and personally owned projects
// with it; anything deliberately kept is severed first and named here so the
// list is auditable rather than implicit.
export async function closeAccount(userId: string): Promise<void> {
  // Moderation history stays, with the author detached. A rejection has to keep
  // explaining itself after the person who was rejected is gone.
  await exec('UPDATE project_message SET author_id = NULL WHERE author_id = $1', [userId])
  await exec('UPDATE report SET reporter_id = NULL WHERE reporter_id = $1', [userId])
  await exec('UPDATE report SET reviewed_by = NULL WHERE reviewed_by = $1', [userId])

  await exec('DELETE FROM "user" WHERE id = $1', [userId])

  queueSweep()
}

export async function accountFootprint(userId: string) {
  const counts = await one<{
    projects: number
    collections: number
    comments: number
    reports: number
  }>(
    `SELECT
       (SELECT count(*)::int FROM project WHERE owner_id = $1)          AS projects,
       (SELECT count(*)::int FROM collection WHERE user_id = $1)        AS collections,
       (SELECT count(*)::int FROM project_comment WHERE author_id = $1) AS comments,
       (SELECT count(*)::int FROM report WHERE reporter_id = $1)        AS reports`,
    [userId],
  )

  return counts ?? { projects: 0, collections: 0, comments: 0, reports: 0 }
}
