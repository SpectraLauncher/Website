
import { exec, one, q } from './db'
import { isLicense, isProjectType, isVersionChannel, type ProjectType } from './catalog-types'
import { normalizeSlug, slugProblem } from './catalog-slug'

export interface ProjectRow {
  id: string
  slug: string
  type: ProjectType
  owner_id: string | null
  org_id: string | null
  title: string
  summary: string
  description: string
  status: string
  license: string | null
  license_url: string | null
  icon: string | null
  categories: string[]
  game_versions: string[]
  loaders: string[]
  links: Record<string, string>
  meta: Record<string, unknown>
  downloads: string | number
  follows: number
  created: string | number
  updated: string | number
  published: string | number | null
}

export interface VersionRow {
  id: string
  project_id: string
  number: string
  name: string
  changelog: string
  channel: string
  game_versions: string[]
  loaders: string[]
  meta: Record<string, unknown>
  downloads: string | number
  created: string | number
}

export interface FileRow {
  id: string
  version_id: string
  filename: string
  size: string | number
  sha1: string
  sha512: string
  is_primary: boolean
  object_key: string
  created: string | number
}

// Postgres hands BIGINT back as a string so nothing is silently truncated. The
// catalog never deals in numbers that large, and the API contract says number,
// so the conversion happens once, here, rather than in every handler.
export function num(value: string | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value)
}

const PROJECT_COLUMNS = `id::text, slug, type, owner_id, org_id, title, summary, description,
  status, license, license_url, icon, categories, game_versions, loaders, links, meta,
  downloads, follows, created, updated, published`

const VERSION_COLUMNS = `id::text, project_id::text, number, name, changelog, channel,
  game_versions, loaders, meta, downloads, created`

const FILE_COLUMNS = `id::text, version_id::text, filename, size, sha1, sha512,
  is_primary, object_key, created`

// --- reads ---------------------------------------------------------------

export async function projectBySlug(slug: string): Promise<ProjectRow | undefined> {
  // sql-safe: PROJECT_COLUMNS is a constant column list
  return await one<ProjectRow>(
    `SELECT ${PROJECT_COLUMNS} FROM project WHERE slug = $1`, [slug])
}

// A caller may hold either a slug or a numeric id — the v2 API accepts both on
// the same path, which is why purely numeric slugs are rejected at creation.
export async function projectByIdOrSlug(key: string): Promise<ProjectRow | undefined> {
  if (/^\d+$/.test(key)) {
    // sql-safe: PROJECT_COLUMNS is a constant column list
    return await one<ProjectRow>(
      `SELECT ${PROJECT_COLUMNS} FROM project WHERE id = $1`, [Number(key)])
  }
  return await projectBySlug(key)
}

export async function versionsOf(projectId: string | number): Promise<VersionRow[]> {
  // sql-safe: VERSION_COLUMNS is a constant column list
  return await q<VersionRow>(
    `SELECT ${VERSION_COLUMNS} FROM version WHERE project_id = $1
     ORDER BY created DESC`, [projectId])
}

export async function versionById(id: string | number): Promise<VersionRow | undefined> {
  // sql-safe: VERSION_COLUMNS is a constant column list
  return await one<VersionRow>(
    `SELECT ${VERSION_COLUMNS} FROM version WHERE id = $1`, [id])
}

export async function filesOf(versionId: string | number): Promise<FileRow[]> {
  // sql-safe: FILE_COLUMNS is a constant column list
  return await q<FileRow>(
    `SELECT ${FILE_COLUMNS} FROM version_file WHERE version_id = $1
     ORDER BY is_primary DESC, filename`, [versionId])
}

export async function filesForVersions(versionIds: Array<string | number>): Promise<FileRow[]> {
  if (!versionIds.length) return []
  // sql-safe: FILE_COLUMNS is a constant column list
  return await q<FileRow>(
    `SELECT ${FILE_COLUMNS} FROM version_file WHERE version_id = ANY($1)
     ORDER BY is_primary DESC, filename`, [versionIds])
}

export async function galleryOf(projectId: string | number) {
  return await q<{ id: string, url: string, title: string, ordering: number, featured: boolean }>(
    `SELECT id::text, url, title, ordering, featured FROM project_gallery
     WHERE project_id = $1 ORDER BY ordering, id`, [projectId])
}

// --- writes --------------------------------------------------------------

// game_versions and loaders on the project are the union over its versions. They
// exist so a listing can filter without touching the version table, which means
// they have to be recomputed whenever a version changes — there is no trigger,
// because this repo has none anywhere.
export async function refreshProjectFacets(projectId: string | number) {
  await exec(
    `UPDATE project SET
       game_versions = COALESCE((
         SELECT array_agg(DISTINCT gv ORDER BY gv) FROM version v,
           LATERAL unnest(v.game_versions) AS gv WHERE v.project_id = $1), '{}'),
       loaders = COALESCE((
         SELECT array_agg(DISTINCT l ORDER BY l) FROM version v,
           LATERAL unnest(v.loaders) AS l WHERE v.project_id = $1), '{}'),
       updated = $2
     WHERE id = $1`,
    [projectId, Date.now()],
  )
}

export interface ProjectInput {
  slug?: unknown
  type?: unknown
  title?: unknown
  summary?: unknown
  description?: unknown
  status?: unknown
  license?: unknown
  licenseUrl?: unknown
  icon?: unknown
  categories?: unknown
  links?: unknown
  meta?: unknown
  orgId?: unknown
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((v): v is string => typeof v === 'string')
    .map(v => v.trim()).filter(Boolean))].slice(0, max)
}

function stringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'string' && item.trim()) out[key.slice(0, 40)] = item.trim().slice(0, 500)
  }
  return out
}

export async function createProject(input: ProjectInput, ownerId: string): Promise<ProjectRow> {
  if (!isProjectType(input.type)) {
    throw createError({ statusCode: 400, statusMessage: 'unknown project type' })
  }

  const title = text(input.title, 160)
  if (!title) throw createError({ statusCode: 400, statusMessage: 'title is required' })

  const slug = normalizeSlug(text(input.slug, 80) || title)
  const problem = slugProblem(slug)
  if (problem) throw createError({ statusCode: 400, statusMessage: `slug ${problem}` })

  if (await projectBySlug(slug)) {
    throw createError({ statusCode: 409, statusMessage: 'slug is taken' })
  }

  const orgId = text(input.orgId, 64) || null
  const now = Date.now()

  // sql-safe: PROJECT_COLUMNS is a constant column list
  const row = await one<ProjectRow>(
    `INSERT INTO project (slug, type, owner_id, org_id, title, summary, description,
                          status, license, license_url, categories, links, meta,
                          created, updated)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, $10, $11, $12, $13, $13)
     RETURNING ${PROJECT_COLUMNS}`,
    [
      slug, input.type, orgId ? null : ownerId, orgId, title,
      text(input.summary, 400), text(input.description, 100_000),
      isLicense(input.license) ? input.license : null,
      text(input.licenseUrl, 500) || null,
      stringList(input.categories, 20),
      JSON.stringify(stringMap(input.links)),
      JSON.stringify(input.meta && typeof input.meta === 'object' ? input.meta : {}),
      now,
    ],
  )

  return row!
}

export async function updateProject(id: string | number, input: ProjectInput): Promise<ProjectRow> {
  // sql-safe: PROJECT_COLUMNS is a constant column list
  const current = await one<ProjectRow>(
    `SELECT ${PROJECT_COLUMNS} FROM project WHERE id = $1`, [id])
  if (!current) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  let slug = current.slug
  if (typeof input.slug === 'string' && input.slug.trim()) {
    slug = normalizeSlug(input.slug)
    const problem = slugProblem(slug)
    if (problem) throw createError({ statusCode: 400, statusMessage: `slug ${problem}` })
    const taken = await projectBySlug(slug)
    if (taken && taken.id !== current.id) {
      throw createError({ statusCode: 409, statusMessage: 'slug is taken' })
    }
  }

  // Ownership moves as a pair: exactly one of the two columns is ever set, which
  // the project_one_owner constraint enforces anyway.
  const orgId = input.orgId === undefined
    ? current.org_id
    : (text(input.orgId, 64) || null)
  const ownerId = orgId ? null : (current.owner_id ?? null)

  if (!orgId && !ownerId) {
    throw createError({ statusCode: 400, statusMessage: 'a project needs an owner' })
  }

  const status = typeof input.status === 'string' ? input.status : current.status
  if (!['draft', 'published', 'archived', 'removed'].includes(status)) {
    throw createError({ statusCode: 400, statusMessage: 'unknown status' })
  }

  // published is stamped once, the first time a project actually goes public.
  const published = status === 'published' && !current.published ? Date.now() : current.published

  // sql-safe: PROJECT_COLUMNS is a constant column list
  const row = await one<ProjectRow>(
    `UPDATE project SET slug = $2, title = $3, summary = $4, description = $5,
       status = $6, license = $7, license_url = $8, icon = $9, categories = $10,
       links = $11, meta = $12, published = $13, updated = $14,
       owner_id = $15, org_id = $16
     WHERE id = $1
     RETURNING ${PROJECT_COLUMNS}`,
    [
      id, slug,
      typeof input.title === 'string' ? text(input.title, 160) || current.title : current.title,
      typeof input.summary === 'string' ? text(input.summary, 400) : current.summary,
      typeof input.description === 'string' ? text(input.description, 100_000) : current.description,
      status,
      input.license === undefined
        ? current.license
        : (isLicense(input.license) ? input.license : null),
      input.licenseUrl === undefined ? current.license_url : (text(input.licenseUrl, 500) || null),
      input.icon === undefined ? current.icon : (text(input.icon, 500) || null),
      input.categories === undefined ? current.categories : stringList(input.categories, 20),
      JSON.stringify(input.links === undefined ? current.links : stringMap(input.links)),
      JSON.stringify(input.meta === undefined
        ? current.meta
        : (input.meta && typeof input.meta === 'object' ? input.meta : {})),
      published,
      Date.now(),
      ownerId,
      orgId,
    ],
  )

  return row!
}

export async function deleteProject(id: string | number) {
  // Files in R2 are content-addressed and shared between versions and projects,
  // so nothing is removed from storage here — a stray object costs pennies, a
  // wrongly deleted one breaks every other project that hashes to it.
  //
  // ponytail: no garbage collection for orphaned objects. Add a sweep that
  // deletes content/ keys with no version_file row once storage cost matters.
  await exec('DELETE FROM project WHERE id = $1', [id])
}

export interface VersionInput {
  number?: unknown
  name?: unknown
  changelog?: unknown
  channel?: unknown
  gameVersions?: unknown
  loaders?: unknown
  meta?: unknown
}

export async function createVersion(
  projectId: string | number,
  input: VersionInput,
): Promise<VersionRow> {
  const number = text(input.number, 60)
  if (!number) throw createError({ statusCode: 400, statusMessage: 'version number is required' })

  const channel = isVersionChannel(input.channel) ? input.channel : 'release'

  const existing = await one<{ id: string }>(
    'SELECT id::text FROM version WHERE project_id = $1 AND number = $2', [projectId, number])
  if (existing) throw createError({ statusCode: 409, statusMessage: 'version number is taken' })

  // sql-safe: VERSION_COLUMNS is a constant column list
  const row = await one<VersionRow>(
    `INSERT INTO version (project_id, number, name, changelog, channel,
                          game_versions, loaders, meta, created)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${VERSION_COLUMNS}`,
    [
      projectId, number, text(input.name, 160), text(input.changelog, 100_000), channel,
      stringList(input.gameVersions, 200), stringList(input.loaders, 20),
      JSON.stringify(input.meta && typeof input.meta === 'object' ? input.meta : {}),
      Date.now(),
    ],
  )

  await refreshProjectFacets(projectId)
  return row!
}

export async function deleteVersion(id: string | number) {
  const version = await versionById(id)
  if (!version) throw createError({ statusCode: 404, statusMessage: 'no such version' })
  await exec('DELETE FROM version WHERE id = $1', [id])
  await refreshProjectFacets(version.project_id)
}

export interface FileInput {
  filename: string
  size: number
  sha1: string
  sha512: string
  key: string
  primary?: boolean
}

export async function attachFile(versionId: string | number, file: FileInput): Promise<FileRow> {
  // sql-safe: FILE_COLUMNS is a constant column list
  const row = await one<FileRow>(
    `INSERT INTO version_file (version_id, filename, size, sha1, sha512,
                               is_primary, object_key, created)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (version_id, filename) DO UPDATE SET
       size = EXCLUDED.size, sha1 = EXCLUDED.sha1, sha512 = EXCLUDED.sha512,
       is_primary = EXCLUDED.is_primary, object_key = EXCLUDED.object_key
     RETURNING ${FILE_COLUMNS}`,
    [
      versionId, file.filename, file.size, file.sha1, file.sha512,
      file.primary ?? true, file.key, Date.now(),
    ],
  )
  return row!
}

// --- listing -------------------------------------------------------------

export interface ListQuery {
  type?: string
  status?: string
  query?: string
  gameVersions?: string[]
  loaders?: string[]
  categories?: string[]
  sort?: 'downloads' | 'updated' | 'created' | 'relevance'
  offset?: number
  limit?: number
}

export interface ListResult {
  hits: ProjectRow[]
  total: number
  offset: number
  limit: number
}

// One query shape for the admin panel, the site and the v2 API. Filters are
// built as parameter placeholders, never as spliced text.
export async function listProjects(input: ListQuery): Promise<ListResult> {
  const where: string[] = []
  const params: unknown[] = []

  const add = (clause: string, value: unknown) => {
    params.push(value)
    // sql-safe: only the placeholder number is substituted, never the value
    where.push(clause.replace('$?', `$${params.length}`))
  }

  if (input.type) add('type = $?', input.type)
  if (input.status) add('status = $?', input.status)
  if (input.gameVersions?.length) add('game_versions && $?', input.gameVersions)
  if (input.loaders?.length) add('loaders && $?', input.loaders)
  if (input.categories?.length) add('categories @> $?', input.categories)

  const search = (input.query ?? '').trim()
  if (search) add(`search @@ plainto_tsquery('simple', $?)`, search)

  // sql-safe: every entry in `where` is a fragment this function wrote, carrying
  // only generated $n placeholders; the values live in `params`
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const order = input.sort === 'updated'
    ? 'updated DESC'
    : input.sort === 'created'
      ? 'created DESC'
      : 'downloads DESC, updated DESC'

  const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 100)
  const offset = Math.max(Number(input.offset) || 0, 0)

  // sql-safe: `clause` is built from generated $n placeholders, values are in `params`
  const counted = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM project ${clause}`, params)

  params.push(limit, offset)
  // sql-safe: constant columns, `clause` is placeholders, `order` is one of three constants
  const hits = await q<ProjectRow>(
    `SELECT ${PROJECT_COLUMNS} FROM project ${clause}
     ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  )

  return { hits, total: counted?.n ?? 0, offset, limit }
}
