export default defineEventHandler(async (event) => {
  await requireModeration(event)

  const files = await filesForVersions([String(getRouterParam(event, 'id') ?? '')])
  const file = files[0]
  if (!file) throw createError({ statusCode: 404, statusMessage: 'no such version' })

  return { file: file.filename, files: await readAddonCodeFiles(file.object_key) }
})
