
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const comment = await commentById(String(getRouterParam(event, 'id') ?? ''))
  if (!comment) throw createError({ statusCode: 404, statusMessage: 'no such comment' })

  const staff = isAdmin(user)
  if (!staff && comment.author_id !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'no such comment' })
  }

  // A moderator hides rather than deletes, so the decision stays reviewable and
  // the replies underneath keep their parent. The author's own delete removes it.
  if (staff && comment.author_id !== user.id) {
    await exec('UPDATE project_comment SET hidden = TRUE WHERE id = $1', [comment.id])
    return { hidden: true }
  }

  await exec('DELETE FROM project_comment WHERE id = $1', [comment.id])
  return { deleted: true }
})
