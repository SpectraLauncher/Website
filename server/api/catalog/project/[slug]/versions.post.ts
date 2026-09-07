import type { VersionInput } from '../../../../utils/catalog'

export default defineEventHandler(async (event) => {
  const { project, user } = await editableProject(event, 'upload_version')

  await requireHeadroom(project.id, 'versionsPerProject', project.owner_id ?? user.id)

  const body = await readBody<VersionInput>(event) ?? {}
  const version = await createVersion(project.id, body)

  setResponseStatus(event, 201)
  return { version: shortVersion(version, []) }
})
