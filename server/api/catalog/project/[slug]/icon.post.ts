const MAX_BYTES = 4 * 1024 * 1024
const ACCEPTED = ['image/webp', 'image/png', 'image/jpeg']

export default defineEventHandler(async (event) => {
  const { project } = await editableProject(event, 'edit_details')

  const url = await storeProjectImage(event, {
    key: `catalog/icons/${project.id}.webp`,
    size: 256,
    accepted: ACCEPTED,
    maxBytes: MAX_BYTES,
    context: 'project',
    subjectId: project.id,
  })

  await exec('UPDATE project SET icon = $2, updated = $3 WHERE id = $1',
    [project.id, url, Date.now()])

  return { icon: url }
})
