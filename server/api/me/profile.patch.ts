
const MAX_BIO = 500

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  rateLimit(event, { key: `profile:${me.id}`, limit: 20, windowMs: 60_000 })

  const body = await readBody<{ bio?: unknown, links?: unknown }>(event) ?? {}

  const bio = body.bio === undefined
    ? undefined
    : String(body.bio ?? '').trim().slice(0, MAX_BIO)

  const links = body.links === undefined ? undefined : cleanLinks(body.links)

  if (bio === undefined && links === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'nothing to update' })
  }

  await exec(
    `UPDATE "user"
     SET bio   = COALESCE($2, bio),
         links = COALESCE($3::jsonb, links)
     WHERE id = $1`,
    [me.id, bio ?? null, links === undefined ? null : JSON.stringify(links)],
  )

  return { bio, links }
})
