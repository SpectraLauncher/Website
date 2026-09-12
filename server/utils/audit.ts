import { one, q } from './db'
import { newId } from './ids'

export type AuditSource = 'panel' | 'discord' | 'script'

export interface StaffActionRow {
  id: string
  actor_id: string | null
  actor_name: string
  action: string
  subject_kind: string
  subject_id: string
  summary: string
  meta: Record<string, unknown> | null
  source: string
  created: string | number
}

export interface StaffActor {
  id: string
  name?: string | null
  username?: string | null
  email?: string | null
}

interface RecordInput {
  actor: StaffActor
  /** Dotted and stable, e.g. project.approve — it is what a filter matches on. */
  action: string
  subjectKind?: string
  subjectId?: string
  summary?: string
  meta?: Record<string, unknown>
  source?: AuditSource
}

const name = (actor: StaffActor) =>
  String(actor.username || actor.name || actor.email || '').slice(0, 120)

/**
 * Write one line into the log.
 *
 * Never throws: an action that already happened must not be undone by a failure
 * to describe it, and a moderator seeing an error after the project was already
 * approved would try again. A lost line is logged to the console instead.
 */
export async function recordStaffAction(input: RecordInput): Promise<void> {
  try {
    await one(
      `INSERT INTO staff_action
         (id, actor_id, actor_name, action, subject_kind, subject_id, summary, meta, source, created)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        newId(),
        input.actor.id,
        name(input.actor),
        input.action.slice(0, 80),
        (input.subjectKind ?? '').slice(0, 40),
        (input.subjectId ?? '').slice(0, 80),
        (input.summary ?? '').slice(0, 400),
        JSON.stringify(input.meta ?? {}),
        input.source ?? 'panel',
        Date.now(),
      ],
    )
  }
  catch (e) {
    console.error('[audit] could not record', input.action, e)
  }
}

export interface AuditFilter {
  actorId?: string
  action?: string
  subjectKind?: string
  subjectId?: string
  limit?: number
  offset?: number
}

const COLUMNS = 'id, actor_id, actor_name, action, subject_kind, subject_id, summary, meta, source, created'

export async function staffActions(filter: AuditFilter = {}): Promise<StaffActionRow[]> {
  const where: string[] = []
  const values: unknown[] = []

  const add = (clause: string, value: unknown) => {
    values.push(value)
    where.push(clause.replace('?', `$${values.length}`))
  }

  if (filter.actorId) add('actor_id = ?', filter.actorId)
  // A prefix, so "project" brings back approve, reject and remove together.
  if (filter.action) add('action LIKE ?', `${filter.action}%`)
  if (filter.subjectKind) add('subject_kind = ?', filter.subjectKind)
  if (filter.subjectId) add('subject_id = ?', filter.subjectId)

  values.push(Math.min(Math.max(filter.limit ?? 50, 1), 200))
  const limit = `$${values.length}`
  values.push(Math.max(filter.offset ?? 0, 0))
  const offset = `$${values.length}`

  // sql-safe: COLUMNS is a constant column list and every clause is a $n
  return await q<StaffActionRow>(
    `SELECT ${COLUMNS} FROM staff_action
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created DESC
     LIMIT ${limit} OFFSET ${offset}`,
    values,
  )
}

export async function countStaffActions(): Promise<number> {
  const row = await one<{ n: number }>('SELECT count(*)::int AS n FROM staff_action')
  return row?.n ?? 0
}

export function auditEntry(row: StaffActionRow) {
  return {
    id: row.id,
    actorId: row.actor_id,
    actor: row.actor_name,
    action: row.action,
    subjectKind: row.subject_kind,
    subjectId: row.subject_id,
    summary: row.summary,
    meta: row.meta ?? {},
    source: row.source,
    created: Number(row.created),
  }
}
