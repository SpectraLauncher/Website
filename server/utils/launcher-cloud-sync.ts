import { createHash, randomUUID } from 'node:crypto'
import { one } from './db'
import { r2Delete, useR2 } from './r2'

export const MAX_LAUNCHER_SYNC_BYTES = 512 * 1024 * 1024
export const LAUNCHER_SYNC_PENDING_MS = 30 * 60 * 1000

export function launcherSyncKey(userId: string) {
  const owner = createHash('sha256').update(userId).digest('hex')
  return `launcher-sync/${owner}/${randomUUID()}.zip`
}

export function validRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

export async function deleteLauncherCloudObjects(userId: string) {
  const r2 = useR2()
  if (!r2) return
  const row = await one<{ object_key: string | null, pending_key: string | null }>(
    'SELECT object_key, pending_key FROM launcher_cloud_sync WHERE user_id = $1', [userId],
  )
  for (const key of [row?.object_key, row?.pending_key]) {
    if (key) await r2Delete(r2, key)
  }
}
