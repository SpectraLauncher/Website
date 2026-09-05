
import type { H3Event } from 'h3'
import type { ProjectRow } from './catalog'
import { projectColumns } from './catalog'
import { LINKABLE_STATUSES, LISTED_STATUSES } from './catalog-types'
import { exec, one, q } from './db'
import { newId } from './ids'
import { requireUser } from './auth'

// Same three answers as a project, for the same reason: "shows in a list" and
// "opens from a link" are different questions.
export const COLLECTION_VISIBILITIES = ['private', 'unlisted', 'listed'] as const
export type CollectionVisibility = typeof COLLECTION_VISIBILITIES[number]

export const MAX_TITLE = 80
export const MAX_SUMMARY = 300
export const MAX_PROJECTS = 500

export interface CollectionRow {
  id: string
  user_id: string
  title: string
  summary: string
  icon: string | null
  visibility: CollectionVisibility
  created: string | number
  updated: string | number
}

const COLUMNS = 'id, user_id, title, summary, icon, visibility, created, updated'

export function isCollectionVisibility(value: unknown): value is CollectionVisibility {
  return COLLECTION_VISIBILITIES.includes(value as CollectionVisibility)
}

export function collectionVisible(
  collection: CollectionRow,
  viewer: { id?: string } | null,
): boolean {
  if (collection.user_id === viewer?.id) return true
  return collection.visibility !== 'private'
}

export async function collectionById(id: string): Promise<CollectionRow | undefined> {
  // sql-safe: COLUMNS is a constant column list
  return await one<CollectionRow>(`SELECT ${COLUMNS} FROM collection WHERE id = $1`, [id])
}

export async function collectionsOf(userId: string, viewerId: string | null) {
  // sql-safe: COLUMNS is a constant column list, prefixed with the alias
  const rows = await q<CollectionRow & { projects: number }>(
    `SELECT ${COLUMNS.split(', ').map(c => `c.${c}`).join(', ')},
            (SELECT count(*)::int FROM collection_project cp WHERE cp.collection_id = c.id) AS projects
     FROM collection c
     WHERE c.user_id = $1 AND ($2 OR c.visibility = 'listed')
     ORDER BY c.updated DESC`,
    [userId, userId === viewerId],
  )
  return rows
}

export async function createCollection(userId: string, input: {
  title?: unknown
  summary?: unknown
  visibility?: unknown
}): Promise<CollectionRow> {
  const title = String(input.title ?? '').trim().slice(0, MAX_TITLE)
  if (!title) throw createError({ statusCode: 400, statusMessage: 'title is required' })

  const now = Date.now()
  // sql-safe: COLUMNS is a constant column list
  const row = await one<CollectionRow>(
    `INSERT INTO collection (id, user_id, title, summary, visibility, created, updated)
     VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING ${COLUMNS}`,
    [
      newId(),
      userId,
      title,
      String(input.summary ?? '').trim().slice(0, MAX_SUMMARY),
      isCollectionVisibility(input.visibility) ? input.visibility : 'private',
      now,
    ],
  )
  return row!
}

export async function updateCollection(id: string, input: {
  title?: unknown
  summary?: unknown
  visibility?: unknown
  icon?: unknown
}): Promise<CollectionRow> {
  const current = await collectionById(id)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'no such collection' })

  const title = input.title === undefined
    ? current.title
    : String(input.title).trim().slice(0, MAX_TITLE) || current.title

  // sql-safe: COLUMNS is a constant column list
  const row = await one<CollectionRow>(
    `UPDATE collection SET title = $2, summary = $3, visibility = $4, icon = $5, updated = $6
     WHERE id = $1 RETURNING ${COLUMNS}`,
    [
      id,
      title,
      input.summary === undefined ? current.summary : String(input.summary).trim().slice(0, MAX_SUMMARY),
      isCollectionVisibility(input.visibility) ? input.visibility : current.visibility,
      input.icon === undefined ? current.icon : (input.icon ? String(input.icon).slice(0, 500) : null),
      Date.now(),
    ],
  )
  return row!
}

export function deleteCollection(id: string) {
  return exec('DELETE FROM collection WHERE id = $1', [id])
}

// A collection may hold a project the viewer cannot see — it went private, or
// moderation took it down after somebody saved it. Those rows stay, so the owner
// does not silently lose the entry, but they are not handed to a stranger.
export async function collectionProjects(
  collectionId: string,
  isOwner: boolean,
): Promise<ProjectRow[]> {
  const statuses = isOwner ? LINKABLE_STATUSES : LISTED_STATUSES
  // sql-safe: projectColumns builds a constant column list, prefixed with the alias
  return await q<ProjectRow>(
    `SELECT ${projectColumns('p')}
     FROM collection_project cp JOIN project p ON p.id = cp.project_id
     WHERE cp.collection_id = $1 AND p.status = ANY($2)
     ORDER BY cp.added DESC`,
    [collectionId, statuses],
  )
}

export async function addToCollection(collectionId: string, projectId: string) {
  const count = await one<{ n: number }>(
    'SELECT count(*)::int AS n FROM collection_project WHERE collection_id = $1',
    [collectionId],
  )
  if ((count?.n ?? 0) >= MAX_PROJECTS) {
    throw createError({ statusCode: 409, statusMessage: 'collection is full' })
  }

  await exec(
    `INSERT INTO collection_project (collection_id, project_id, added)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [collectionId, projectId, Date.now()],
  )
  await touch(collectionId)
}

export async function removeFromCollection(collectionId: string, projectId: string) {
  await exec('DELETE FROM collection_project WHERE collection_id = $1 AND project_id = $2',
    [collectionId, projectId])
  await touch(collectionId)
}

function touch(collectionId: string) {
  return exec('UPDATE collection SET updated = $2 WHERE id = $1', [collectionId, Date.now()])
}

export async function collectionsHolding(userId: string, projectId: string): Promise<string[]> {
  const rows = await q<{ collection_id: string }>(
    `SELECT cp.collection_id FROM collection_project cp
     JOIN collection c ON c.id = cp.collection_id
     WHERE c.user_id = $1 AND cp.project_id = $2`,
    [userId, projectId],
  )
  return rows.map(row => row.collection_id)
}

export function publicCollection(row: CollectionRow & { projects?: number }) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    icon: row.icon,
    visibility: row.visibility,
    projects: row.projects ?? 0,
    created: Number(row.created),
    updated: Number(row.updated),
  }
}

export async function collectionOwner(userId: string) {
  return await one<{ username: string | null, name: string | null, image: string | null }>(
    'SELECT username, name, image FROM "user" WHERE id = $1', [userId])
}

// Somebody else's collection answers 404 rather than 403: a forbidden reply
// would confirm that the id exists and belongs to someone.
export async function requireOwnCollection(event: H3Event): Promise<CollectionRow> {
  const user = await requireUser(event)
  const collection = await collectionById(String(getRouterParam(event, 'id') ?? ''))

  if (!collection || collection.user_id !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'no such collection' })
  }
  return collection
}
