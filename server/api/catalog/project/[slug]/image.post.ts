const MAX_BYTES = 8 * 1024 * 1024
const ACCEPTED = ['image/webp', 'image/png', 'image/jpeg', 'image/gif']

// An image for the description, rather than the gallery. Same store and the
// same ownership record, but it is not a screenshot the project page lists.
export default defineEventHandler(async (event) => {
  const { project } = await editableProject(event, 'edit_body')

  const id = newId()
  const url = await storeProjectImage(event, {
    key: `catalog/body/${project.id}/${id}.webp`,
    size: 1600,
    fit: 'inside',
    accepted: ACCEPTED,
    maxBytes: MAX_BYTES,
    context: 'project',
    subjectId: project.id,
  })

  setResponseStatus(event, 201)
  return { url }
})
