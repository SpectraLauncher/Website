import { projectPath } from '../../shared/utils/catalog-types'
import type { ProfileEvent } from '../../shared/utils/profile-events'

const LIMIT = 12

// A comment is shown as one line under the project it sits on, so the body is
// cut here rather than shipped whole and clipped with CSS.
const EXCERPT = 140

function excerpt(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  return flat.length > EXCERPT ? `${flat.slice(0, EXCERPT - 1).trimEnd()}…` : flat
}

async function releases(userId: string): Promise<ProfileEvent[]> {
  const rows = await q<{
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

  return rows.map(row => ({
    kind: 'release',
    at: Number(row.created),
    title: row.title,
    path: projectPath(row.type, row.slug),
    version: row.number,
    gameVersions: row.game_versions ?? [],
    loaders: row.loaders ?? [],
  }))
}

async function publications(userId: string): Promise<ProfileEvent[]> {
  const rows = await q<{ title: string, slug: string, type: string, published: string | number }>(
    `SELECT title, slug, type, published FROM project
     WHERE owner_id = $1 AND status = 'published' AND published IS NOT NULL
     ORDER BY published DESC LIMIT $2`,
    [userId, LIMIT],
  )

  return rows.map(row => ({
    kind: 'publish',
    at: Number(row.published),
    title: row.title,
    path: projectPath(row.type, row.slug),
    type: row.type,
  }))
}

// A hidden comment is hidden everywhere, including here — a moderator taking one
// down must not leave it legible on its author's profile.
async function comments(userId: string): Promise<ProfileEvent[]> {
  const rows = await q<{
    body: string
    created: string | number
    title: string
    slug: string
    type: string
  }>(
    `SELECT c.body, c.created, p.title, p.slug, p.type
     FROM project_comment c JOIN project p ON p.id = c.project_id
     WHERE c.author_id = $1 AND NOT c.hidden AND p.status = 'published'
     ORDER BY c.created DESC LIMIT $2`,
    [userId, LIMIT],
  )

  return rows.map(row => ({
    kind: 'comment',
    at: Number(row.created),
    title: row.title,
    path: projectPath(row.type, row.slug),
    excerpt: excerpt(row.body ?? ''),
  }))
}

async function organizations(userId: string): Promise<ProfileEvent[]> {
  const rows = await q<{ name: string, slug: string, role: string, createdAt: string | number }>(
    `SELECT o.name, o.slug, m.role, m."createdAt"
     FROM member m JOIN organization o ON o.id = m."organizationId"
     WHERE m."userId" = $1
     ORDER BY m."createdAt" DESC LIMIT $2`,
    [userId, LIMIT],
  )

  return rows.map(row => ({
    kind: 'org',
    at: Number(row.createdAt),
    title: row.name,
    path: `/org/${row.slug}`,
    role: row.role,
  }))
}

/**
 * Every source is catalog content, so the whole feed sits behind the catalog
 * gate — otherwise a profile would name projects the listings still answer 404
 * for. Organizations count too: /org is one of the catalog's prefixes.
 */
export async function profileFeed(userId: string, withCatalog: boolean): Promise<ProfileEvent[]> {
  if (!withCatalog) return []

  const sources = await Promise.all([
    releases(userId),
    publications(userId),
    comments(userId),
    organizations(userId),
  ])

  return sources.flat()
    .filter(event => Number.isFinite(event.at) && event.at > 0)
    .sort((a, b) => b.at - a.at)
    .slice(0, LIMIT)
}
