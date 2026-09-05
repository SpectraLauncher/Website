import { registerJobHandlers } from '../utils/jobs'
import { pruneJobs, recoverStaleJobs, runJobs } from '../utils/queue'

// Polling, not a cron service. The interval is short enough that a queued mail
// goes out while the person is still looking at the page, and the work itself
// is claimed with SKIP LOCKED, so running this on every replica is safe.
//
// JOB_WORKER=false turns it off, for a replica meant to serve requests only.
const TICK_MS = 5_000
const RECOVER_EVERY = 12
const PRUNE_EVERY = 720

export default defineNitroPlugin(() => {
  if (import.meta.prerender) return
  if (process.env.JOB_WORKER === 'false') return

  registerJobHandlers()

  let ticks = 0
  let stopped = false

  const tick = async () => {
    if (stopped) return

    try {
      ticks++
      if (ticks % RECOVER_EVERY === 0) {
        // A worker that died mid-job left its row claimed; nobody else can take
        // it until the lock is called dead.
        const recovered = await recoverStaleJobs()
        if (recovered) console.warn(`[queue] returned ${recovered} stale job(s) to the queue`)
      }
      if (ticks % PRUNE_EVERY === 0) await pruneJobs()

      await runJobs()
    }
    catch (e) {
      // The loop must outlive any single failure, including the database being
      // briefly unreachable.
      console.error('[queue] tick', e)
    }
    finally {
      if (!stopped) setTimeout(tick, TICK_MS).unref?.()
    }
  }

  setTimeout(tick, TICK_MS).unref?.()

  return () => { stopped = true }
})
