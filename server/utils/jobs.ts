
import { sweepOrphans } from './images'
import { deliverNotificationMail } from './notification-copy'
import { registerJob } from './queue'
import { scanFile } from './scan-queue'

// Where a job kind meets the code that does the work. Kept apart from the queue
// itself so the queue does not import half the application, and apart from the
// callers so nothing has to hold a function it wants to run later.
//
// To add a kind: one entry here, one in JobKind, and enqueue it with a payload
// that survives JSON.
let wired = false

export function registerJobHandlers() {
  if (wired) return
  wired = true

  registerJob('mail', async (payload) => {
    await deliverNotificationMail({
      userId: String(payload.userId ?? ''),
      kind: String(payload.kind ?? ''),
      actorId: payload.actorId ? String(payload.actorId) : null,
      projectId: payload.projectId ? String(payload.projectId) : null,
    })
  })

  registerJob('scan', async (payload) => {
    const fileId = String(payload.fileId ?? '')
    if (fileId) await scanFile(fileId)
  })

  registerJob('cleanup', async () => {
    const removed = await sweepOrphans()
    if (removed) console.info(`[images] removed ${removed} orphaned object(s)`)
  })
}
