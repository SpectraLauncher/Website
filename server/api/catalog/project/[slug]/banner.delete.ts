export default defineEventHandler(async (event) => {
  const { project } = await editableProject(event, 'edit_details')

  await exec('UPDATE project SET banner = NULL, updated = $2 WHERE id = $1',
    [project.id, Date.now()])

  if (project.banner) await dropStoredImage(project.banner)

  setResponseStatus(event, 204)
  return null
})
