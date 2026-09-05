export default defineEventHandler(async (event) => {
  const admin = await requireCatalogWrite(event)
  const body = await readBody<ProjectInput>(event) ?? {}

  // An organization project counts against the organization, so a personal
  // ceiling only applies when the account itself will own it.
  if (!body.orgId) await requireHeadroom(admin.id, 'projects')

  const project = await createProject(body, admin.id)

  setResponseStatus(event, 201)
  return { project: fullProject(project, [], []) }
})
