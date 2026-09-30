export default defineEventHandler(async (event) => {
  const { project } = await editableProject(event, 'delete_project')

  await deleteProject(project.id)
  return { ok: true }
})
