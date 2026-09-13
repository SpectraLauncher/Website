const MAX_BYTES = 6 * 1024 * 1024
const WIDTH = 1920

export default defineEventHandler(async (event) => {
  const { project } = await editableProject(event, 'edit_details')

  // 'inside' keeps the shape: a banner cropped to a square would be nobody's
  // banner. The page draws it at most 560px tall — see UiBackdrop.
  const url = await storeProjectImage(event, {
    key: `catalog/banners/${project.id}.webp`,
    size: WIDTH,
    fit: 'inside',
    accepted: [...MOVING_IMAGE_TYPES],
    animated: true,
    maxBytes: MAX_BYTES,
    context: 'project',
    subjectId: project.id,
  })

  const previous = project.banner
  await exec('UPDATE project SET banner = $2, updated = $3 WHERE id = $1',
    [project.id, url, Date.now()])

  // The replaced one has nothing pointing at it any more.
  if (previous && previous !== url) await dropStoredImage(previous)

  return { banner: url }
})
