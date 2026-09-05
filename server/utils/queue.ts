
import { exec, one, q, usePool } from './db'
import { newId } from './ids'

// Work that must not sit inside a request, kept in the database rather than in
// memory. A closure cannot survive a restart, so a job is a kind plus a payload
// and the handler is looked up when the job runs.
//
// Claiming uses FOR UPDATE SKIP LOCKED, which is what makes several replicas
// safe to run against one table: each worker takes a row nobody else holds.
export type JobKind = 'mail' | 'scan' | 'cleanup'

type Handler = (payload: Record<string, unknown>) => Promise<void>

// To add a job kind: one entry here and one string in JobKind.
const HANDLERS = new Map<JobKind, Handler>()

export function registerJob(kind: JobKind, handler: Handler) {
  HANDLERS.set(kind, handler)
}

const MAX_ATTEMPTS = 3
const RETRY_BASE_MS = 30_000
const BATCH = 5

// A worker that dies mid-job leaves the row claimed. Anything held longer than
// this is assumed dead and goes back into the line.
const LOCK_TIMEOUT_MS = 5 * 60_000

const workerId = newId()

export async function enqueue(
  kind: JobKind,
  payload: Record<string, unknown> = {},
  runAfter = Date.now(),
): Promise<void> {
  await exec(
    `INSERT INTO job (id, kind, payload, run_after, created)
     VALUES ($1, $2, $3, $4, $5)`,
    [newId(), kind, JSON.stringify(payload), runAfter, Date.now()],
  )
}

interface JobRow {
  id: string
  kind: string
  payload: Record<string, unknown> | null
  attempts: number
}

// One row at a time, claimed atomically. The inner select picks a candidate and
// SKIP LOCKED steps over rows another worker is already taking, so two workers
// never run the same job.
async function claim(): Promise<JobRow | undefined> {
  return await one<JobRow>(
    `UPDATE job SET status = 'running', locked_by = $1, locked_at = $2
     WHERE id = (
       SELECT id FROM job
       WHERE status = 'pending' AND run_after <= $2
       ORDER BY run_after
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING id, kind, payload, attempts`,
    [workerId, Date.now()],
  )
}

async function release(job: JobRow, error: unknown) {
  const attempts = job.attempts + 1
  const message = String(error instanceof Error ? error.message : error).slice(0, 500)

  if (attempts >= MAX_ATTEMPTS) {
    await exec(
      `UPDATE job SET status = 'failed', attempts = $2, last_error = $3 WHERE id = $1`,
      [job.id, attempts, message],
    )
    console.error(`[queue] ${job.kind} gave up after ${attempts} attempts: ${message}`)
    return
  }

  await exec(
    `UPDATE job SET status = 'pending', attempts = $2, last_error = $3,
       run_after = $4, locked_by = NULL, locked_at = NULL
     WHERE id = $1`,
    [job.id, attempts, message, Date.now() + attempts * RETRY_BASE_MS],
  )
}

let running = false

export async function runJobs(limit = BATCH): Promise<number> {
  if (running) return 0
  running = true

  let done = 0
  try {
    for (let i = 0; i < limit; i++) {
      const job = await claim()
      if (!job) break

      const handler = HANDLERS.get(job.kind as JobKind)
      if (!handler) {
        await release(job, `no handler for ${job.kind}`)
        continue
      }

      try {
        await handler(job.payload ?? {})
        await exec(`UPDATE job SET status = 'done' WHERE id = $1`, [job.id])
        done++
      }
      catch (e) {
        await release(job, e)
      }
    }
  }
  finally {
    running = false
  }

  return done
}

export async function recoverStaleJobs(): Promise<number> {
  return await exec(
    `UPDATE job SET status = 'pending', locked_by = NULL, locked_at = NULL
     WHERE status = 'running' AND locked_at < $1`,
    [Date.now() - LOCK_TIMEOUT_MS],
  )
}

// Finished rows are not interesting once they are finished, and a table that
// only grows is a table that eventually gets slow.
export async function pruneJobs(olderThanDays = 7): Promise<number> {
  return await exec(
    `DELETE FROM job WHERE status = 'done' AND created < $1`,
    [Date.now() - olderThanDays * 86_400_000],
  )
}

export async function queueDepth() {
  const rows = await q<{ status: string, kind: string, n: number }>(
    'SELECT status, kind, count(*)::int AS n FROM job GROUP BY status, kind')

  const out = { pending: 0, running: 0, failed: 0, byKind: {} as Record<string, number> }
  for (const row of rows) {
    if (row.status === 'pending') out.pending += row.n
    if (row.status === 'running') out.running += row.n
    if (row.status === 'failed') out.failed += row.n
    out.byKind[`${row.kind}:${row.status}`] = row.n
  }
  return out
}

export async function retryFailed(kind?: string): Promise<number> {
  const params: unknown[] = [Date.now()]
  let clause = ''
  if (kind) {
    params.push(kind)
    clause = ` AND kind = $${params.length}` // sql-safe: placeholder number only
  }

  // sql-safe: `clause` is a generated placeholder, never request text
  return await exec(
    `UPDATE job SET status = 'pending', attempts = 0, run_after = $1 WHERE status = 'failed'${clause}`,
    params,
  )
}

// Tests drive the loop by hand rather than waiting on the poller.
export async function drainForTests(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    if (!await runJobs(20)) return
  }
}

export function resetQueue() {
  return usePool().query('TRUNCATE job')
}
