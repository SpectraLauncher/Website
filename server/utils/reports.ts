
import type { H3Event } from 'h3'
import { isAdmin } from './admin'
import { projectPath } from './catalog-types'
import { exec, one, q } from './db'
import { newId } from './ids'

export interface ReportRow {
  id: string
  reason: string
  item_type: string
  item_id: string
  reporter_id: string | null
  body: string
  status: string
  note: string
  reviewed_by: string | null
  reviewed_at: string | number | null
  created: string | number
}

const COLUMNS = `id, reason, item_type, item_id, reporter_id, body, status, note,
  reviewed_by, reviewed_at, created`

export async function reportById(id: string): Promise<ReportRow | undefined> {
  // sql-safe: COLUMNS is a constant column list
  return await one<ReportRow>(`SELECT ${COLUMNS} FROM report WHERE id = $1`, [id])
}

// Whether the thing being reported exists at all. A report against nothing is
// noise in the queue, and letting it through turns the form into a way to
// probe which ids are real.
export async function reportedItemExists(itemType: string, itemId: string): Promise<boolean> {
  const table = {
    project: 'project',
    version: 'version',
    user: '"user"',
    comment: 'project_comment',
    organization: 'organization',
  }[itemType]

  if (!table) return false

  // sql-safe: `table` comes from the map above, never from the request
  const row = await one<{ id: string }>(`SELECT id FROM ${table} WHERE id = $1`, [itemId])
  return Boolean(row)
}

export async function createReport(input: {
  reason: string
  itemType: string
  itemId: string
  reporterId: string
  body: string
}): Promise<ReportRow> {
  const id = newId()

  // sql-safe: COLUMNS is a constant column list
  const row = await one<ReportRow>(
    `INSERT INTO report (id, reason, item_type, item_id, reporter_id, body, created)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (reporter_id, item_type, item_id) WHERE status = 'open' AND reporter_id IS NOT NULL
     DO NOTHING
     RETURNING ${COLUMNS}`,
    [id, input.reason, input.itemType, input.itemId, input.reporterId, input.body, Date.now()],
  )

  if (!row) {
    throw createError({ statusCode: 409, statusMessage: 'you already reported this' })
  }
  return row
}

export interface ReportQuery {
  status?: string
  reporterId?: string
  limit?: number
  offset?: number
}

export async function listReports(input: ReportQuery) {
  const where: string[] = []
  const params: unknown[] = []

  if (input.status) {
    params.push(input.status)
    where.push(`status = $${params.length}`) // sql-safe: placeholder number only
  }
  if (input.reporterId) {
    params.push(input.reporterId)
    where.push(`reporter_id = $${params.length}`) // sql-safe: placeholder number only
  }

  // sql-safe: every fragment was written here and carries only $n placeholders
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 100)
  const offset = Math.max(Number(input.offset) || 0, 0)

  // sql-safe: `clause` is generated placeholders, COLUMNS is constant
  const counted = await one<{ n: number }>(`SELECT count(*)::int AS n FROM report ${clause}`, params)

  params.push(limit, offset)
  // sql-safe: COLUMNS and `clause` are constant or generated; oldest first is a queue
  const rows = await q<ReportRow>(
    `SELECT ${COLUMNS} FROM report ${clause}
     ORDER BY created ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  )

  return { rows, total: counted?.n ?? 0, limit, offset }
}

export async function closeReport(input: {
  id: string
  status: string
  note: string
  moderatorId: string
}): Promise<ReportRow> {
  // sql-safe: COLUMNS is a constant column list
  const row = await one<ReportRow>(
    `UPDATE report SET status = $2, note = $3, reviewed_by = $4, reviewed_at = $5
     WHERE id = $1 RETURNING ${COLUMNS}`,
    [input.id, input.status, input.note, input.moderatorId, Date.now()],
  )
  if (!row) throw createError({ statusCode: 404, statusMessage: 'no such report' })
  return row
}

export async function openReportCount(): Promise<number> {
  const row = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM report WHERE status = 'open'`)
  return row?.n ?? 0
}

// Where a moderator goes to look at the thing being complained about. A comment
// has no page of its own, so it points at the project carrying it.
export async function reportTarget(row: ReportRow): Promise<{ label: string, path: string } | null> {
  if (row.item_type === 'project') {
    const project = await one<{ title: string, slug: string, type: string }>(
      'SELECT title, slug, type FROM project WHERE id = $1', [row.item_id])
    return project ? { label: project.title, path: projectPath(project.type, project.slug) } : null
  }

  if (row.item_type === 'comment') {
    const comment = await one<{ title: string, slug: string, type: string }>(
      `SELECT p.title, p.slug, p.type FROM project_comment c
       JOIN project p ON p.id = c.project_id WHERE c.id = $1`,
      [row.item_id],
    )
    return comment ? { label: comment.title, path: projectPath(comment.type, comment.slug) } : null
  }

  if (row.item_type === 'user') {
    const user = await one<{ username: string | null }>(
      'SELECT username FROM "user" WHERE id = $1', [row.item_id])
    return user?.username ? { label: user.username, path: `/u/${user.username}` } : null
  }

  if (row.item_type === 'organization') {
    const org = await one<{ name: string, slug: string }>(
      'SELECT name, slug FROM organization WHERE id = $1', [row.item_id])
    return org ? { label: org.name, path: `/org/${org.slug}` } : null
  }

  if (row.item_type === 'version') {
    const version = await one<{ number: string, slug: string, type: string }>(
      `SELECT v.number, p.slug, p.type FROM version v
       JOIN project p ON p.id = v.project_id WHERE v.id = $1`,
      [row.item_id],
    )
    return version
      ? { label: version.number, path: projectPath(version.type, version.slug) }
      : null
  }

  return null
}

export function publicReport(row: ReportRow, target: { label: string, path: string } | null) {
  return {
    id: row.id,
    reason: row.reason,
    itemType: row.item_type,
    itemId: row.item_id,
    body: row.body,
    status: row.status,
    note: row.note,
    created: Number(row.created),
    reviewedAt: row.reviewed_at === null ? null : Number(row.reviewed_at),
    target,
  }
}

export function deleteReport(id: string) {
  return exec('DELETE FROM report WHERE id = $1', [id])
}

// A report is visible to the person who filed it and to moderators, nobody
// else. Anyone else gets the same answer as a report that does not exist.
export async function reportForViewer(event: H3Event): Promise<ReportRow> {
  const user = await requireUser(event)

  const report = await reportById(String(getRouterParam(event, 'id') ?? ''))
  if (!report) throw createError({ statusCode: 404, statusMessage: 'no such report' })

  if (!isAdmin(user) && report.reporter_id !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'no such report' })
  }

  return report
}
