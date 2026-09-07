export default defineEventHandler(async (event) => {
  const { project } = await editableProject(event, 'delete_version')

  const id = String(getRouterParam(event, 'version') ?? '')

  const version = await versionById(id)
  if (!version || version.project_id !== project.id) {
    throw createError({ statusCode: 404, statusMessage: 'no such version' })
  }

  await deleteVersion(id)
  return { ok: true }
})
