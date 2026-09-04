export default defineEventHandler(async (event) => {
  const admin = await requireCatalogWrite(event)
  const body = await readBody<ProjectInput>(event) ?? {}
  const project = await createProject(body, admin.id)

  setResponseStatus(event, 201)
  return { project: fullProject(project, [], []) }
})
