
// Work that must not sit inside a request. A hung SMTP server or a slow scan of
// a 200 MB jar should never be what a person waits for.
//
// in-process and in-memory, so a restart drops whatever is queued and
// each replica keeps its own line. That is acceptable for mail and scanning —
// both are retried or re-triggered — and not acceptable for anything that must
// happen exactly once. Move to a table or Redis before putting money in here.
export type JobKind = 'mail' | 'scan' | 'cleanup'

interface Job {
  kind: JobKind
  run: () => Promise<void>
  attempts: number
}

const MAX_ATTEMPTS = 3
const CONCURRENCY = 2
const RETRY_BASE_MS = 5_000

const pending: Job[] = []
let running = 0

// A job waiting out its back-off is neither pending nor running, and without
// this it is invisible: the depth reads zero while work is still owed.
let retrying = 0

// Kept for the health endpoint, so a queue quietly filling up is visible.
const failures: Record<string, number> = {}

export function enqueue(kind: JobKind, run: () => Promise<void>) {
  pending.push({ kind, run, attempts: 0 })
  drain()
}

function drain() {
  while (running < CONCURRENCY && pending.length) {
    const job = pending.shift()!
    running++

    job.run()
      .catch((e) => {
        job.attempts++
        if (job.attempts < MAX_ATTEMPTS) {
          // Linear back-off is enough: these are minutes-scale failures, not
          // a thundering herd against someone else's API.
          retrying++
          setTimeout(() => {
            retrying--
            pending.push(job)
            drain()
          }, job.attempts * RETRY_BASE_MS)
          return
        }

        failures[job.kind] = (failures[job.kind] ?? 0) + 1
        console.error(`[queue] ${job.kind} gave up after ${job.attempts} attempts`, e)
      })
      .finally(() => {
        running--
        drain()
      })
  }
}

export function queueDepth(): {
  pending: number
  running: number
  retrying: number
  failures: Record<string, number>
} {
  return { pending: pending.length, running, retrying, failures: { ...failures } }
}

// Tests need a way to run the line to the end without sleeping on timers.
export async function drainForTests(): Promise<void> {
  while (pending.length || running || retrying) {
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}

export function resetQueue() {
  pending.length = 0
  running = 0
  retrying = 0
  for (const key of Object.keys(failures)) delete failures[key]
}
