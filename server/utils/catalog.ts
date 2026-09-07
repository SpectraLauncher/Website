
import { exec, one, q } from './db'
import { isPublicId, newId } from './ids'
import {
  LISTED_STATUSES,
  categoriesFor,
  loadersForType,
  isEnvironment,
  isLicense,
  isProjectStatus,
  isProjectType,
  isVersionChannel,
  type ProjectType,
} from '../../shared/utils/catalog-types'
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
  environment: string[]
  links: Record<string, string>
  disclosures: DisclosureMap
  meta: Record<string, unknown>
  price: number
  currency: string
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

const PROJECT_COLUMNS = `id, slug, type, owner_id, org_id, title, summary, description,
  status, license, license_url, icon, categories, game_versions, loaders, environment,
  links, disclosures, meta, price, currency, downloads, follows, created, updated, published`

// The column list spans lines, so a join that needs it aliased cannot just glue
// a prefix onto a split on ", ".
export function projectColumns(alias: string): string {
  return PROJECT_COLUMNS.split(',').map(c => `${alias}.${c.trim()}`).join(', ')
}

const VERSION_COLUMNS = `id, project_id, number, name, changelog, channel,
  game_versions, loaders, meta, downloads, created`

const FILE_COLUMNS = `id, version_id, filename, size, sha1, sha512,
  is_primary, object_key, created`

export async function projectBySlug(slug: string): Promise<ProjectRow | undefined> {
  // sql-safe: PROJECT_COLUMNS is a constant column list
  return await one<ProjectRow>(
    `SELECT ${PROJECT_COLUMNS} FROM project WHERE slug = $1`, [slug])
}

// A caller may hold either a slug or an id, and both arrive on the same path.
// Ids are tried first; slugs shaped like one are refused at creation, so the two
// can never mean different projects.
export async function projectByIdOrSlug(key: string): Promise<ProjectRow | undefined> {
  if (isPublicId(key)) {
    // sql-safe: PROJECT_COLUMNS is a constant column list
    const found = await one<ProjectRow>(
      `SELECT ${PROJECT_COLUMNS} FROM project WHERE id = $1`, [key])
    if (found) return found
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
    `SELECT id, url, title, ordering, featured FROM project_gallery
     WHERE project_id = $1 ORDER BY ordering, id`, [projectId])
}

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
  disclosures?: unknown
  meta?: unknown
  orgId?: unknown
  environment?: unknown
  authorship?: unknown
  price?: unknown
  currency?: unknown
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((v): v is string => typeof v === 'string')
    .map(v => v.trim()).filter(Boolean))].slice(0, max)
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

  // The claim is refused rather than defaulted. A project with no recorded
  // declaration is one nobody can be held to later, which is the whole point of
  // recording it.
  if (input.authorship !== AUTHORSHIP_TERMS && input.authorship !== true) {
    throw createError({
      statusCode: 400,
      statusMessage: 'the authorship declaration has to be accepted',
    })
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
      JSON.stringify(cleanLinks(input.links)),
      JSON.stringify(input.meta && typeof input.meta === 'object' ? input.meta : {}),
      now,
      ownerId,
      AUTHORSHIP_TERMS,
      newId(),
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

  const orgId = input.orgId === undefined
    ? current.org_id
    : (text(input.orgId, 64) || null)
  const ownerId = orgId ? null : (current.owner_id ?? null)

  if (!orgId && !ownerId) {
    throw createError({ statusCode: 400, statusMessage: 'a project needs an owner' })
  }

  const price = input.price === undefined ? current.price : Math.floor(Number(input.price) || 0)
  if (price < 0 || (price > 0 && (price < MIN_PRICE_MINOR || price > MAX_PRICE_MINOR))) {
    throw createError({ statusCode: 400, statusMessage: 'price is outside the allowed range' })
  }

  const currency = input.currency === undefined
    ? current.currency
    : String(input.currency).toLowerCase()
  if (!isCurrency(currency)) {
    throw createError({ statusCode: 400, statusMessage: 'unsupported currency' })
  }

  const status = typeof input.status === 'string' ? input.status : current.status
  if (!isProjectStatus(status)) {
    throw createError({ statusCode: 400, statusMessage: 'unknown status' })
  }

  const published = status === 'published' && !current.published ? Date.now() : current.published

  // sql-safe: PROJECT_COLUMNS is a constant column list
  const row = await one<ProjectRow>(
    `UPDATE project SET slug = $2, title = $3, summary = $4, description = $5,
       status = $6, license = $7, license_url = $8, icon = $9, categories = $10,
       links = $11, disclosures = $12, meta = $13, published = $14, updated = $15,
       owner_id = $16, org_id = $17, price = $18, currency = $19,
       environment = $20
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
      input.icon === undefined ? current.icon : safeAssetUrl(input.icon),
      input.categories === undefined
        ? current.categories
        : stringList(input.categories, 20)
          .filter(c => categoriesFor(current.type).includes(c)),
      JSON.stringify(input.links === undefined ? current.links : cleanLinks(input.links)),
      JSON.stringify(input.disclosures === undefined
        ? current.disclosures
        : mergeAuthorEdit(current.disclosures, cleanDisclosures(input.disclosures))),
      JSON.stringify(input.meta === undefined
        ? current.meta
        : (input.meta && typeof input.meta === 'object' ? input.meta : {})),
      published,
      Date.now(),
      ownerId,
      orgId,
      price,
      currency,
      input.environment === undefined
        ? current.environment
        : stringList(input.environment, 4).filter(isEnvironment),
    ],
  )

  return row!
}

export async function deleteProject(id: string | number) {
  // Files in R2 are content-addressed and shared between versions and projects,
  // so nothing is removed from storage here — a stray object costs pennies, a
  // wrongly deleted one breaks every other project that hashes to it.
  //
  // no garbage collection for orphaned objects. Add a sweep that
  // deletes content/ keys with no version_file row once storage cost matters.
  await exec('DELETE FROM project WHERE id = $1', [id])
}

export interface VersionInput {
  packFiles?: unknown
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
    'SELECT id FROM version WHERE project_id = $1 AND number = $2', [projectId, number])
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
      newId(),
    ],
  )

  if (Array.isArray(input.packFiles) && input.packFiles.length) {
    await replaceDependencies(row!.id, input.packFiles as never)
  }

  await refreshProjectFacets(projectId)
  return row!
}

export async function updateVersion(
  id: string,
  input: VersionInput,
): Promise<VersionRow> {
  const current = await versionById(id)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'no such version' })

  const number = input.number === undefined ? current.number : text(input.number, 60)
  if (!number) throw createError({ statusCode: 400, statusMessage: 'version number is required' })

  if (number !== current.number) {
    const taken = await one<{ id: string }>(
      'SELECT id FROM version WHERE project_id = $1 AND number = $2 AND id <> $3',
      [current.project_id, number, id])
    if (taken) throw createError({ statusCode: 409, statusMessage: 'version number is taken' })
  }

  // sql-safe: VERSION_COLUMNS is a constant column list
  const row = await one<VersionRow>(
    `UPDATE version SET number = $2, name = $3, changelog = $4, channel = $5,
       game_versions = $6, loaders = $7, meta = $8
     WHERE id = $1
     RETURNING ${VERSION_COLUMNS}`,
    [
      id, number,
      input.name === undefined ? current.name : text(input.name, 160),
      input.changelog === undefined ? current.changelog : text(input.changelog, 100_000),
      isVersionChannel(input.channel) ? input.channel : current.channel,
      input.gameVersions === undefined
        ? current.game_versions
        : stringList(input.gameVersions, 200),
      input.loaders === undefined ? current.loaders : stringList(input.loaders, 20),
      JSON.stringify(input.meta === undefined
        ? current.meta
        : (input.meta && typeof input.meta === 'object' ? input.meta : {})),
    ],
  )

  await refreshProjectFacets(current.project_id)
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
      file.primary ?? true, file.key, Date.now(), newId(),
    ],
  )
  return row!
}

export interface ListQuery {
  ownerId?: string
  type?: string
  statuses?: readonly string[]
  query?: string
  gameVersions?: string[]
  loaders?: string[]
  categories?: string[]
  environment?: string[]
  licenses?: string[]
  sort?: 'downloads' | 'updated' | 'created' | 'relevance'
  direction?: 'asc' | 'desc'
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

  if (input.ownerId) add('owner_id = $?', input.ownerId)

  // A project belongs to a listing either because that is its own type or
  // because it carries a loader belonging to that type, so a jar built for
  // Fabric and for Paper is found under both.
  if (input.type && isProjectType(input.type)) {
    const kin = loadersForType(input.type)
    params.push(input.type, kin)
    where.push(`(type = $${params.length - 1} OR loaders && $${params.length})`) // sql-safe: placeholder numbers only
  }
  // Absent means the listed set, never "everything" — a listing that forgets to
  // pass a status must not start showing drafts.
  add('status = ANY($?)', input.statuses ?? LISTED_STATUSES)
  if (input.gameVersions?.length) add('game_versions && $?', input.gameVersions)
  if (input.loaders?.length) add('loaders && $?', input.loaders)
  if (input.categories?.length) add('categories @> $?', input.categories)
  if (input.environment?.length) add('environment && $?', input.environment)
  if (input.licenses?.length) add('license = ANY($?)', input.licenses)

  const search = (input.query ?? '').trim()
  let searchParam = 0
  if (search) {
    add(`search @@ plainto_tsquery('simple', $?)`, search)
    searchParam = params.length
  }

  // sql-safe: every entry in `where` is a fragment this function wrote, carrying
  // only generated $n placeholders; the values live in `params`
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  // Relevance needs a query to rank against; without one it means nothing, so it
  // falls back rather than ordering everything by a constant zero.
  const oldestFirst = input.direction === 'asc'

  const order = input.sort === 'updated'
    ? (oldestFirst ? 'updated ASC' : 'updated DESC')
    : input.sort === 'created'
      ? (oldestFirst ? 'created ASC' : 'created DESC')
      : input.sort === 'relevance' && searchParam
        // sql-safe: searchParam is a placeholder number this function generated
        ? `ts_rank_cd(search, plainto_tsquery('simple', $${searchParam})) DESC, downloads DESC`
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

export interface FacetGroup {
  value: string
  count: number
}

export interface Facets {
  gameVersions: FacetGroup[]
  loaders: FacetGroup[]
  categories: FacetGroup[]
  environment: FacetGroup[]
  licenses: FacetGroup[]
}

// Counts for the browse sidebar. Only values something published actually
// carries: a filter that returns nothing the moment it is clicked is worse than
// no filter, and the whole point of showing counts is to promise otherwise.
//
// computed per request off the live table. Materialise into a facet
// table on a timer once this stops being instant, which for Postgres is a long
// way past where this catalog will ever get.
export async function catalogFacets(type?: string): Promise<Facets> {
  const params: unknown[] = [LISTED_STATUSES]
  const scope = type ? 'AND (p.type = $2 OR p.loaders && $3)' : ''
  if (type) params.push(type, isProjectType(type) ? loadersForType(type) : [])

  const spread = async (column: string) => {
    // sql-safe: `column` and `scope` are constants chosen here, never request text
    return await q<FacetGroup>(
      `SELECT value, count(*)::int AS count
       FROM project p, LATERAL unnest(p.${column}) AS value
       WHERE p.status = ANY($1) ${scope}
       GROUP BY value ORDER BY count DESC, value`,
      params,
    )
  }

  // sql-safe: `scope` is a constant fragment chosen above, never request text
  const licenses = await q<FacetGroup>(
    `SELECT license AS value, count(*)::int AS count
     FROM project p
     WHERE p.status = ANY($1) AND license IS NOT NULL ${scope}
     GROUP BY license ORDER BY count DESC, license`,
    params,
  )

  return {
    gameVersions: await spread('game_versions'),
    loaders: await spread('loaders'),
    categories: await spread('categories'),
    environment: await spread('environment'),
    licenses,
  }
}

export async function followProject(userId: string, projectId: string) {
  const added = await exec(
    `INSERT INTO project_follow (user_id, project_id, created) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [userId, projectId, Date.now()],
  )
  if (added) await exec('UPDATE project SET follows = follows + 1 WHERE id = $1', [projectId])
  return added > 0
}

export async function unfollowProject(userId: string, projectId: string) {
  const removed = await exec(
    'DELETE FROM project_follow WHERE user_id = $1 AND project_id = $2', [userId, projectId])
  if (removed) {
    await exec('UPDATE project SET follows = GREATEST(follows - 1, 0) WHERE id = $1', [projectId])
  }
  return removed > 0
}

export async function isFollowing(userId: string, projectId: string): Promise<boolean> {
  const row = await one<{ user_id: string }>(
    'SELECT user_id FROM project_follow WHERE user_id = $1 AND project_id = $2',
    [userId, projectId])
  return Boolean(row)
}

export interface GalleryImage {
  id: string
  url: string
  title: string
  ordering: number
  featured: boolean
}

export async function addGalleryImage(
  id: string,
  projectId: string,
  url: string,
  ordering: number,
): Promise<GalleryImage> {
  const row = await one<GalleryImage>(
    `INSERT INTO project_gallery (id, project_id, url, ordering, created)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, url, title, ordering, featured`,
    [id, projectId, url, ordering, Date.now()],
  )
  return row!
}

export async function updateGalleryImage(id: string, patch: {
  title?: string
  ordering?: number
  featured?: boolean
}): Promise<GalleryImage | undefined> {
  return await one<GalleryImage>(
    `UPDATE project_gallery
     SET title = COALESCE($2, title),
         ordering = COALESCE($3, ordering),
         featured = COALESCE($4, featured)
     WHERE id = $1
     RETURNING id, url, title, ordering, featured`,
    [id, patch.title ?? null, patch.ordering ?? null, patch.featured ?? null],
  )
}

export async function removeGalleryImage(id: string) {
  await exec('DELETE FROM project_gallery WHERE id = $1', [id])
}

export async function projectsByIds(ids: string[]): Promise<Map<string, ProjectRow>> {
  if (!ids.length) return new Map()
  // sql-safe: PROJECT_COLUMNS is a constant column list
  const rows = await q<ProjectRow>(
    `SELECT ${PROJECT_COLUMNS} FROM project WHERE id = ANY($1)`, [ids])
  return new Map(rows.map(row => [row.id, row]))
}

export async function ownedProjects(userId: string, orgIds: string[]): Promise<ProjectRow[]> {
  // sql-safe: PROJECT_COLUMNS is a constant column list
  return await q<ProjectRow>(
    `SELECT ${PROJECT_COLUMNS} FROM project
     WHERE owner_id = $1 OR ($2::text[] <> '{}' AND org_id = ANY($2))
     ORDER BY updated DESC`,
    [userId, orgIds],
  )
}

export interface QueueCounts {
  pending: number
  rejected: number
  draft: number
}

export async function queueCounts(): Promise<QueueCounts> {
  const rows = await q<{ status: string, n: number }>(
    `SELECT status, count(*)::int AS n FROM project
     WHERE status = ANY($1) GROUP BY status`,
    [['pending', 'rejected', 'draft']],
  )

  const by = new Map(rows.map(row => [row.status, row.n]))
  return {
    pending: by.get('pending') ?? 0,
    rejected: by.get('rejected') ?? 0,
    draft: by.get('draft') ?? 0,
  }
}
