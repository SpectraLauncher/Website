
import { exec, one, q } from './db'
import { newId } from './ids'

export const MAX_BODY = 65_536

export interface MessageRow {
  id: string
  project_id: string
  author_id: string | null
  staff: boolean
  body: string
  status: string | null
  created: string | number
}

export interface CommentRow {
  id: string
  project_id: string
  author_id: string
  parent_id: string | null
  body: string
  hidden: boolean
  created: string | number
  updated: string | number | null
}

export interface Author {
  id: string
  name: string | null
  username: string | null
  image: string | null
}

const AUTHOR_JOIN = `u.id AS a_id, u.name AS a_name, u.username AS a_username, u.image AS a_image`

function author(row: Record<string, unknown>): Author | null {
  return row.a_id
    ? {
        id: row.a_id as string,
        name: (row.a_name as string) ?? null,
        username: (row.a_username as string) ?? null,
        image: (row.a_image as string) ?? null,
      }
    : null
}

export function cleanBody(value: unknown): string {
  const body = String(value ?? '').trim()
  if (!body) throw createError({ statusCode: 400, statusMessage: 'message is empty' })
  return body.slice(0, MAX_BODY)
}

export async function threadFor(projectId: string) {
  // sql-safe: AUTHOR_JOIN is a constant column list
  const rows = await q<MessageRow & Record<string, unknown>>(
    `SELECT m.id, m.project_id, m.author_id, m.staff, m.body, m.status, m.created, ${AUTHOR_JOIN}
     FROM project_message m LEFT JOIN "user" u ON u.id = m.author_id
     WHERE m.project_id = $1 ORDER BY m.created ASC`,
    [projectId],
  )

  return rows.map(row => ({
    id: row.id,
    body: row.body,
    staff: row.staff,
    status: row.status,
    created: Number(row.created),
    author: author(row),
  }))
}

export async function postMessage(input: {
  projectId?: string | null
  reportId?: string | null
  authorId: string
  staff: boolean
  body: string
  status?: string | null
}) {
  const id = newId()
  await exec(
    `INSERT INTO project_message (id, project_id, report_id, author_id, staff, body, status, created)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      input.projectId ?? null,
      input.reportId ?? null,
      input.authorId,
      input.staff,
      input.body,
      input.status ?? null,
      Date.now(),
    ],
  )
  return id
}

export async function listComments(
  projectId: string,
  viewerIsStaff: boolean,
  hiddenAuthors: string[] = [],
) {
  // sql-safe: AUTHOR_JOIN is a constant column list
  const rows = await q<CommentRow & Record<string, unknown>>(
    `SELECT c.id, c.project_id, c.author_id, c.parent_id, c.body, c.hidden,
            c.created, c.updated, ${AUTHOR_JOIN}
     FROM project_comment c JOIN "user" u ON u.id = c.author_id
     WHERE c.project_id = $1 AND ($2 OR NOT c.hidden)
       AND NOT (c.author_id = ANY($3))
     ORDER BY c.created ASC`,
    [projectId, viewerIsStaff, hiddenAuthors],
  )

  const shape = (row: typeof rows[number]) => ({
    id: row.id,
    parentId: row.parent_id,
    // A hidden comment keeps its row so the reply thread under it survives, but
    // its text is not handed out to anyone but staff.
    body: row.hidden && !viewerIsStaff ? '' : row.body,
    hidden: row.hidden,
    created: Number(row.created),
    updated: row.updated === null ? null : Number(row.updated),
    author: author(row)!,
    replies: [] as ReturnType<typeof shape>[],
  })

  const all = rows.map(shape)
  const byId = new Map(all.map(c => [c.id, c]))
  const roots: typeof all = []

  for (const comment of all) {
    const parent = comment.parentId ? byId.get(comment.parentId) : undefined
    if (parent) parent.replies.push(comment)
    else roots.push(comment)
  }

  roots.reverse()
  return roots
}

export async function commentById(id: string): Promise<CommentRow | undefined> {
  return await one<CommentRow>(
    `SELECT id, project_id, author_id, parent_id, body, hidden, created, updated
     FROM project_comment WHERE id = $1`,
    [id],
  )
}

export async function addComment(input: {
  projectId: string
  authorId: string
  body: string
  parentId?: string | null
}) {
  let parentId: string | null = null

  if (input.parentId) {
    const parent = await commentById(input.parentId)
    if (!parent || parent.project_id !== input.projectId) {
      throw createError({ statusCode: 400, statusMessage: 'no such comment' })
    }
    // One level only: a reply to a reply attaches to the same root.
    parentId = parent.parent_id ?? parent.id
  }

  const id = newId()
  await exec(
    `INSERT INTO project_comment (id, project_id, author_id, parent_id, body, created)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, input.projectId, input.authorId, parentId, input.body, Date.now()],
  )

  return { id, parentId }
}

export async function countComments(projectId: string): Promise<number> {
  const row = await one<{ n: number }>(
    'SELECT count(*)::int AS n FROM project_comment WHERE project_id = $1 AND NOT hidden',
    [projectId],
  )
  return row?.n ?? 0
}

// The same thread, hanging off a report instead of a project. A moderator who
// cannot ask "which file exactly?" has to guess, and guessing is how a correct
// report gets dismissed.
export async function reportThread(reportId: string) {
  // sql-safe: AUTHOR_JOIN is a constant column list
  const rows = await q<MessageRow & Record<string, unknown>>(
    `SELECT m.id, m.project_id, m.author_id, m.staff, m.body, m.status, m.created, ${AUTHOR_JOIN}
     FROM project_message m LEFT JOIN "user" u ON u.id = m.author_id
     WHERE m.report_id = $1 ORDER BY m.created ASC`,
    [reportId],
  )

  return rows.map(row => ({
    id: row.id,
    body: row.body,
    staff: row.staff,
    status: row.status,
    created: Number(row.created),
    author: author(row),
  }))
}
