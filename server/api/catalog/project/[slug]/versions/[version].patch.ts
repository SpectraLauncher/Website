import type { VersionInput } from '../../../../../utils/catalog'

export default defineEventHandler(async (event) => {
  const { project } = await editableProject(event, 'upload_version')

  const id = String(getRouterParam(event, 'version') ?? '')

  // The version has to belong to this project, or upload rights on one project
  // would be edit rights on every version in the catalog.
  const version = await versionById(id)
  if (!version || version.project_id !== project.id) {
    throw createError({ statusCode: 404, statusMessage: 'no such version' })
  }

  const body = await readBody<VersionInput>(event) ?? {}
  const updated = await updateVersion(id, body)

  return { version: shortVersion(updated, await filesOf(id)) }
})
