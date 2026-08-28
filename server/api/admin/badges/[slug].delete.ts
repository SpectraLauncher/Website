
import { r2Delete, useR2 } from '../../../utils/r2'

const IMAGE_EXTENSIONS = ['webp', 'png', 'jpg']

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const slug = String(getRouterParam(event, 'slug') ?? '').toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{1,38}$/.test(slug)) {
    throw createError({ statusCode: 400, statusMessage: 'bad slug' })
  }

  const r2 = useR2()

  if (r2) {
    for (const ext of IMAGE_EXTENSIONS) {
      await r2Delete(r2, `badges/${slug}.${ext}`)
        .catch(e => console.error('[badge] r2 delete', slug, ext, e))
    }
  }

  await exec('DELETE FROM badge WHERE slug = $1', [slug])

  return { ok: true }
})
