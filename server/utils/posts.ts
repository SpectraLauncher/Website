import { normalizeSlug, slugProblem } from '../../shared/utils/catalog-slug'
import { postExcerpt, postImageUrls, renderPostDoc } from '../../shared/utils/post-doc'
import { exec, one, q } from './db'
import { newId } from './ids'
import { dropStoredImage, keyFromUrl } from './images'

export const POST_KINDS = ['article', 'newsletter'] as const
export type PostKind = typeof POST_KINDS[number]

export function isPostKind(value: unknown): value is PostKind {
  return POST_KINDS.includes(value as PostKind)
}

export interface PostRow {
  id: string
  kind: PostKind
  slug: string | null
  title: string
  summary: string
  body: unknown
  cover: string | null
  status: string
  author_id: string | null
  created: string | number
  updated: string | number
  published: string | number | null
  sent: string | number | null
  recipients: number
}

const COLUMNS = `id, kind, slug, title, summary, body, cover, status, author_id,
  created, updated, published, sent, recipients`

const num = (value: string | number | null) => (value === null ? null : Number(value))

/** What a reader gets: rendered once here, so no HTML from a client is stored. */
export function publicPost(row: PostRow) {
  return {
    id: row.id,
    kind: row.kind,
    slug: row.slug,
    title: row.title,
    summary: row.summary || postExcerpt(row.body),
    html: renderPostDoc(row.body),
    cover: row.cover,
    published: num(row.published),
    updated: num(row.updated),
  }
}

/** What a listing card shows: no body, because a list of ten would ship ten. */
export function postCard(row: PostRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary || postExcerpt(row.body, 160),
    cover: row.cover,
    published: num(row.published),
  }
}

/** What the editor gets: the document itself, and everything it may change. */
export function editablePost(row: PostRow) {
  return {
    id: row.id,
    kind: row.kind,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    cover: row.cover,
    status: row.status,
    created: num(row.created),
    updated: num(row.updated),
    published: num(row.published),
    sent: num(row.sent),
    recipients: row.recipients,
  }
}

export async function postById(id: string): Promise<PostRow | undefined> {
  // sql-safe: COLUMNS is a constant column list
  return await one<PostRow>(`SELECT ${COLUMNS} FROM post WHERE id = $1`, [id])
}

export async function publishedArticle(slug: string): Promise<PostRow | undefined> {
  // sql-safe: COLUMNS is a constant column list
  return await one<PostRow>(
    `SELECT ${COLUMNS} FROM post
     WHERE kind = 'article' AND status = 'published' AND lower(slug) = lower($1)`,
    [slug],
  )
}

export async function publishedArticles(limit = 20, offset = 0): Promise<PostRow[]> {
  // sql-safe: COLUMNS is a constant column list
  return await q<PostRow>(
    `SELECT ${COLUMNS} FROM post
     WHERE kind = 'article' AND status = 'published'
     ORDER BY published DESC NULLS LAST
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  )
}

export async function countPublishedArticles(): Promise<number> {
  const row = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM post WHERE kind = 'article' AND status = 'published'`)
  return row?.n ?? 0
}

export async function postsOfKind(kind: PostKind): Promise<PostRow[]> {
  // sql-safe: COLUMNS is a constant column list
  return await q<PostRow>(
    `SELECT ${COLUMNS} FROM post WHERE kind = $1
     ORDER BY COALESCE(published, updated) DESC`,
    [kind],
  )
}

export async function createPost(kind: PostKind, authorId: string): Promise<PostRow> {
  const now = Date.now()

  // sql-safe: COLUMNS is a constant column list
  return (await one<PostRow>(
    `INSERT INTO post (id, kind, title, body, status, author_id, created, updated)
     VALUES ($1, $2, '', '{"type":"doc","content":[]}'::jsonb, 'draft', $3, $4, $4)
     RETURNING ${COLUMNS}`,
    [newId(), kind, authorId, now],
  ))!
}

export interface PostInput {
  title?: unknown
  summary?: unknown
  slug?: unknown
  body?: unknown
  cover?: unknown
  status?: unknown
}

const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)

/**
 * An article's address, checked against the same blacklist project slugs use —
 * /news/settings would be harmless, but the list is also where the words we
 * intend to turn into routes live, and one list is easier to trust than two.
 */
async function resolveSlug(row: PostRow, raw: unknown): Promise<string | null> {
  if (row.kind !== 'article') return null

  const wanted = normalizeSlug(text(raw, 80)) || normalizeSlug(text(row.title, 80))
  if (!wanted) return row.slug

  const problem = slugProblem(wanted)
  if (problem) throw createError({ statusCode: 400, statusMessage: `slug is ${problem}` })

  const taken = await one<{ id: string }>(
    'SELECT id FROM post WHERE slug = $1 AND id <> $2', [wanted, row.id])
  if (taken) throw createError({ statusCode: 409, statusMessage: 'slug is taken' })

  return wanted
}

export async function updatePost(id: string, input: PostInput): Promise<PostRow> {
  const current = await postById(id)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'no such post' })

  const status = input.status === 'published' || input.status === 'draft'
    ? input.status
    : current.status

  // Stamped the first time it goes out and never moved again: an edit is not a
  // republication, and re-dating it would shuffle the listing.
  const published = status === 'published'
    ? (num(current.published) ?? Date.now())
    : null

  const cover = input.cover === undefined
    ? current.cover
    : (typeof input.cover === 'string' && input.cover ? input.cover : null)

  // sql-safe: COLUMNS is a constant column list
  const row = (await one<PostRow>(
    `UPDATE post SET title = $2, summary = $3, slug = $4, body = $5, cover = $6,
       status = $7, published = $8, updated = $9
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [
      id,
      input.title === undefined ? current.title : text(input.title, 160),
      input.summary === undefined ? current.summary : text(input.summary, 400),
      await resolveSlug(current, input.slug),
      JSON.stringify(input.body === undefined ? current.body : (input.body ?? {})),
      cover,
      status,
      published,
      Date.now(),
    ],
  ))!

  // A cover swapped for another leaves the old object behind, and nothing else
  // will ever point at it. The sweep would find it in an hour; this is the same
  // answer now, and it is the one the author expects.
  if (current.cover && current.cover !== row.cover) await dropStoredImage(current.cover)

  await dropUnusedImages(current, row)
  return row
}

/** Pictures that were in the body a moment ago and are not in it now. */
async function dropUnusedImages(before: PostRow, after: PostRow) {
  const kept = new Set(postImageUrls(after.body).map(keyFromUrl).filter(Boolean))

  for (const url of postImageUrls(before.body)) {
    const key = keyFromUrl(url)
    if (key && !kept.has(key)) await dropStoredImage(url)
  }
}

export async function deletePost(id: string) {
  const row = await postById(id)
  if (!row) return

  // Everything it pointed at goes with it, rather than waiting for a sweep to
  // notice the subject is gone.
  for (const url of postImageUrls(row.body)) await dropStoredImage(url)
  if (row.cover) await dropStoredImage(row.cover)

  await exec('DELETE FROM post WHERE id = $1', [id])
}
