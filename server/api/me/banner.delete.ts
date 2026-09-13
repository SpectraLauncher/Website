export default defineEventHandler(async (event) => {
  const me = await requireUser(event)

  const row = await one<{ banner: string | null }>(
    'SELECT banner FROM "user" WHERE id = $1', [me.id])

  await exec('UPDATE "user" SET banner = NULL WHERE id = $1', [me.id])

  // Taken out of the bucket now rather than left for the sweep: the person
  // asked for it to be gone.
  if (row?.banner) await dropStoredImage(row.banner)

  setResponseStatus(event, 204)
  return null
})
