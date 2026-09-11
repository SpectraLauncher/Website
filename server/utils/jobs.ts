
import { sweepOrphans } from './images'
import { deliverIssue } from './newsletter'
import { deliverNotificationMail } from './notification-copy'
import { registerJob } from './queue'
import { transferForSale } from './transfers'
import { scanFile } from './scan-queue'

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

  // Enqueued when a payment succeeds, to run once the grace period is up. The
  // delay is the whole point of separate charges and transfers: until it passes
  // the money is still somewhere we control.
  registerJob('transfer', async (payload) => {
    const saleId = String(payload.saleId ?? '')
    if (saleId) await transferForSale(saleId)
  })

  // One job per address rather than one per issue: a list of a few hundred is
  // more SMTP than a request can hold, and a bounce retries that address alone.
  registerJob('newsletter', async (payload) => {
    await deliverIssue(
      String(payload.postId ?? ''),
      String(payload.email ?? ''),
      String(payload.token ?? ''),
      String(payload.origin ?? ''),
    )
  })

  registerJob('cleanup', async () => {
    const removed = await sweepOrphans()
    if (removed) console.info(`[images] removed ${removed} orphaned object(s)`)
  })
}
