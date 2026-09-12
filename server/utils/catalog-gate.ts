
import type { H3Event } from 'h3'

// One flag for the whole catalog. While it is off, every catalog route — pages,
// the public API and the Modrinth-compatible API — exists for the admin only and
// answers 404 to everyone else. Opening it to the world is a change to
// NUXT_PUBLIC_CATALOG_PUBLIC, not a hunt for conditions scattered across files.
//
// That prefix is required rather than decorative: Nuxt overrides a public
// runtime value only from the env var named after its key path, so under any
// other name this reads whatever the build saw and never changes again.
//
// The comparison is explicit because Boolean('false') is true, and this flag
// holds the gates for the entire catalog — a stray string has to leave it shut.
// Env values arrive as strings, so 'true' has to count.
export function catalogIsPublic(): boolean {
  const value = useRuntimeConfig().public.catalogPublic
  return value === true || value === 'true'
}

// Catalog read access. Returns the signed-in user, or null once the catalog is
// public — at that point anonymous readers are allowed too.
//
// While it is shut, reading is open to anyone on the team rather than to admins
// alone: a moderator whose whole job is the review queue has to be able to open
// the projects in it, and gating this on isAdmin made the role unusable — the
// queue listed rows that every one of them answered 404 for.
export async function requireCatalogRead(event: H3Event) {
  if (catalogIsPublic()) return await optionalUser(event)

  const user = await requireUser(event)
  if (!canModerate(user)) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return user
}

// Catalog write access. Stays admin-only even after reads open up — open upload
// ships together with moderation, as a separate decision and a separate stage.
export async function requireCatalogWrite(event: H3Event) {
  return await requireAdmin(event)
}

// Whether catalog content may reach the sitemap, llms.txt, feeds and public
// listings. Named separately from catalogIsPublic because it is a different
// question asked in a different place, and a grep for it should find something.
export function catalogIsIndexable(): boolean {
  return catalogIsPublic()
}
