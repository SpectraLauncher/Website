
import { exec, one } from './db'

// Every delivery is written down before anything acts on it. Two reasons, and
// the second is the one that matters: a handler that throws leaves a row saying
// what arrived and what went wrong, and a delivery Stripe repeats finds its own
// id already there and stops.
//
// Stripe retries for days, so "at least once" is the guarantee to build against.
// Idempotency is the primary key here, plus a unique index on the ledger behind
// it, because one of the two will be the one that holds.
export async function recordEvent(input: {
  id: string
  type: string
  payload: unknown
}): Promise<boolean> {
  const inserted = await exec(
    `INSERT INTO webhook_event (id, type, payload, received)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [input.id, input.type, JSON.stringify(input.payload), Date.now()],
  )

  return inserted > 0
}

export async function markProcessed(id: string): Promise<void> {
  await exec('UPDATE webhook_event SET processed = $2, error = NULL WHERE id = $1',
    [id, Date.now()])
}

// Left unprocessed on purpose. Stripe will deliver it again, the insert above
// will find the id and refuse, and this row is then the only record that it was
// tried - which is why the attempt count and the message live here rather than
// only in a log.
export async function markFailed(id: string, error: unknown): Promise<void> {
  await exec(
    `UPDATE webhook_event SET attempts = attempts + 1, error = $2 WHERE id = $1`,
    [id, String((error as Error)?.message ?? error).slice(0, 1000)],
  )
}

export async function wasProcessed(id: string): Promise<boolean> {
  const row = await one<{ processed: string | null }>(
    'SELECT processed FROM webhook_event WHERE id = $1', [id])

  return Boolean(row?.processed)
}
