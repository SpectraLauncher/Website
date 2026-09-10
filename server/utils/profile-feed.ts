import { projectPath } from '../../shared/utils/catalog-types'
import type { ProfileEvent } from '../../shared/utils/profile-events'

const LIMIT = 12

/**
 * Everything the catalog knows. Runs only while the catalog is readable —
 * otherwise a profile would leak project names the listings still answer 404
 * for. Organizations count as catalog content: /org is one of its prefixes.
 */
async function catalogEvents(userId: string): Promise<ProfileEvent[]> {
  const releases = await q<{
    number: string
    created: string | number
    game_versions: string[]
    loaders: string[]
    title: string
    slug: string
    type: string
  }>(
    `SELECT v.number, v.created, v.game_versions, v.loaders, p.title, p.slug, p.type
     FROM version v JOIN project p ON p.id = v.project_id
     WHERE p.owner_id = $1 AND p.status = 'published'
     ORDER BY v.created DESC LIMIT $2`,
    [userId, LIMIT],
  )

  const published = await q<{
    title: string
    slug: string
    type: string
    published: string | number
  }>(
    `SELECT title, slug, type, published FROM project
     WHERE owner_id = $1 AND status = 'published' AND published IS NOT NULL
     ORDER BY published DESC LIMIT $2`,
    [userId, LIMIT],
  )

  const orgs = await q<{ name: string, slug: string, role: string, createdAt: string | number }>(
    `SELECT o.name, o.slug, m.role, m."createdAt"
     FROM member m JOIN organization o ON o.id = m."organizationId"
     WHERE m."userId" = $1
     ORDER BY m."createdAt" DESC LIMIT $2`,
    [userId, LIMIT],
  )

  return [
    ...releases.map((row): ProfileEvent => ({
      kind: 'release',
      at: Number(row.created),
      title: row.title,
      path: projectPath(row.type, row.slug),
      version: row.number,
      gameVersions: row.game_versions ?? [],
      loaders: row.loaders ?? [],
    })),
    ...published.map((row): ProfileEvent => ({
      kind: 'publish',
      at: Number(row.published),
      title: row.title,
      path: projectPath(row.type, row.slug),
      type: row.type,
    })),
    ...orgs.map((row): ProfileEvent => ({
      kind: 'org',
      at: Number(row.createdAt),
      title: row.name,
      path: `/org/${row.slug}`,
      role: row.role,
    })),
  ]
}

/**
 * Play days become one entry each. The launcher reports a daily total rather
 * than sessions, so the timestamp is midnight UTC of that day — good enough for
 * a feed that only ever renders "3 days ago".
 */
function playEvents(days: Array<{ day: string, launches: number, seconds: number }>): ProfileEvent[] {
  return days
    .filter(row => row.seconds > 0)
    .slice(-LIMIT)
    .map(row => ({
      kind: 'play' as const,
      at: Date.parse(`${row.day}T00:00:00Z`),
      seconds: row.seconds,
      launches: row.launches,
    }))
}

export async function profileFeed(
  userId: string,
  days: Array<{ day: string, launches: number, seconds: number }>,
  withCatalog: boolean,
): Promise<ProfileEvent[]> {
  const events = [
    ...(withCatalog ? await catalogEvents(userId) : []),
    ...playEvents(days),
  ]

  return events
    .filter(event => Number.isFinite(event.at) && event.at > 0)
    .sort((a, b) => b.at - a.at)
    .slice(0, LIMIT)
}
