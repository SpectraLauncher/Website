
import { exec, q } from './db'
import { r2Delete, useR2 } from './r2'

const AVATAR_EXTENSIONS = ['webp', 'png', 'jpg']

export async function deleteAccount(id: string): Promise<void> {
  const r2 = useR2()
  if (r2) {
    const packs = await q<{ object_key: string | null, pending_key: string | null }>(
      'SELECT object_key, pending_key FROM shares WHERE owner_id = $1', [id])

    const keys = [
      ...packs.flatMap(p => [p.object_key, p.pending_key]),
      ...AVATAR_EXTENSIONS.map(ext => `avatars/${id}.${ext}`),
    ].filter((k): k is string => !!k)

    for (const key of keys) {
      await r2Delete(r2, key).catch(e => console.error('[account] r2 delete', key, e))
    }
  }

  await exec('DELETE FROM shares WHERE owner_id = $1', [id])
  await exec('DELETE FROM "user" WHERE id = $1', [id])
}
