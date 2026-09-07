
import { exec, one, q } from './db'
import { newId } from './ids'
import { enqueue } from './queue'
import { r2Delete, useR2 } from './r2'

// Every stored image knows what it belongs to. Without that, deleting a project
// leaves its pictures in the bucket forever and the bill grows quietly.
//
// To add a context: one entry here and the matching column on the table.
export const IMAGE_CONTEXTS = ['project', 'version', 'organization', 'user', 'report'] as const
export type ImageContext = typeof IMAGE_CONTEXTS[number]

export function isImageContext(value: unknown): value is ImageContext {
  return IMAGE_CONTEXTS.includes(value as ImageContext)
}

export interface ImageRow {
  id: string
  object_key: string
  context: string
  owner_id: string | null
  subject_id: string | null
  size: string | number
  created: string | number
}

export async function recordImage(input: {
  key: string
  context: ImageContext
  ownerId: string | null
  subjectId: string | null
  size: number
}): Promise<string> {
  const id = newId()
  await exec(
    `INSERT INTO stored_image (id, object_key, context, owner_id, subject_id, size, created)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (object_key) DO UPDATE
       SET context = EXCLUDED.context,
           subject_id = EXCLUDED.subject_id,
           size = EXCLUDED.size`,
    [id, input.key, input.context, input.ownerId, input.subjectId, input.size, Date.now()],
  )
  return id
}

export function forgetImage(key: string) {
  return exec('DELETE FROM stored_image WHERE object_key = $1', [key])
}

// Stored URLs carry a cache-busting query, so the key has to be recovered from
// the path rather than compared whole.
export function keyFromUrl(url: string): string | null {
  const r2 = useR2()
  if (!r2 || !url.startsWith(`${r2.publicUrl}/`)) return null

  const key = url.slice(r2.publicUrl.length + 1).split('?')[0]
  return key || null
}

// Delete the object and forget the row. Used wherever the caller already knows
// which image is going, so nothing has to wait for a sweep to notice.
export async function dropStoredImage(url: string): Promise<boolean> {
  const r2 = useR2()
  const key = keyFromUrl(url)
  if (!r2 || !key) return false

  const gone = await r2Delete(r2, key)
  await forgetImage(key)
  return gone
}

// One row points at five different things, so the subject cannot be a foreign
// key and the check is a join per context instead.
// How long an image gets to be pointed at by something before the sweep counts
// it as unreferenced.
const UNREFERENCED_GRACE_MS = 60 * 60 * 1000

export async function orphanedImages(limit = 200): Promise<ImageRow[]> {
  return await q<ImageRow>(
    `SELECT i.id, i.object_key, i.context, i.owner_id, i.subject_id, i.size, i.created
     FROM stored_image i
     WHERE i.subject_id IS NOT NULL
       AND (
         -- the thing the image belonged to is gone
         CASE i.context
           WHEN 'project'      THEN NOT EXISTS (SELECT 1 FROM project p WHERE p.id = i.subject_id)
           WHEN 'version'      THEN NOT EXISTS (SELECT 1 FROM version v WHERE v.id = i.subject_id)
           WHEN 'organization' THEN NOT EXISTS (SELECT 1 FROM organization o WHERE o.id = i.subject_id)
           WHEN 'user'         THEN NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = i.subject_id)
           WHEN 'report'       THEN NOT EXISTS (SELECT 1 FROM report r WHERE r.id = i.subject_id)
           ELSE FALSE
         END
         -- or the project is still there and nothing in it points at the image
         -- any more: a gallery entry deleted, a picture cut out of a
         -- description, an icon replaced by one under a different key.
         --
         -- Only once it has had an hour to be referenced. An image is uploaded
         -- before the description that mentions it is saved, and a sweep in
         -- between would delete the picture out from under the author.
         OR (i.context = 'project' AND i.created < $2
             AND EXISTS (SELECT 1 FROM project p WHERE p.id = i.subject_id)
             AND NOT EXISTS (
               SELECT 1 FROM project_gallery g
               WHERE g.project_id = i.subject_id AND g.url LIKE '%' || i.object_key || '%')
             AND NOT EXISTS (
               SELECT 1 FROM project p
               WHERE p.id = i.subject_id
                 AND (p.description LIKE '%' || i.object_key || '%'
                      OR COALESCE(p.icon, '') LIKE '%' || i.object_key || '%')))
       )
     ORDER BY i.created ASC
     LIMIT $1`,
    [limit, Date.now() - UNREFERENCED_GRACE_MS],
  )
}

// Deleting from the bucket is not transactional with the row, so the row goes
// last: a leftover object is a wasted byte, a leftover row that points at
// nothing is a broken image on a page.
export async function sweepOrphans(limit = 200): Promise<number> {
  const r2 = useR2()
  if (!r2) return 0

  const rows = await orphanedImages(limit)
  let removed = 0

  for (const row of rows) {
    try {
      await r2Delete(r2, row.object_key)
      await forgetImage(row.object_key)
      removed++
    }
    catch (e) {
      console.error('[images] sweep', row.object_key, e)
    }
  }

  return removed
}

export function queueSweep() {
  return enqueue('cleanup')
}

export async function imageStats(): Promise<{ tracked: number, orphaned: number, bytes: number }> {
  const totals = await one<{ n: number, bytes: string | null }>(
    'SELECT count(*)::int AS n, COALESCE(SUM(size), 0) AS bytes FROM stored_image')

  return {
    tracked: totals?.n ?? 0,
    orphaned: (await orphanedImages(1000)).length,
    bytes: Number(totals?.bytes ?? 0),
  }
}
