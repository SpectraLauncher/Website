
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!project || !await canSeeThread(project, user)) {
    throw createError({ statusCode: 404, statusMessage: 'no such project' })
  }

  rateLimit(event, { key: `submit:${user.id}`, limit: 5, windowMs: 60_000 })

  if (!isSubmittable(project.status)) {
    throw createError({ statusCode: 409, statusMessage: 'this project cannot be submitted' })
  }

  // Nothing to review without a file: an empty submission wastes a moderator's
  // turn and the author cannot tell why it came back.
  const versions = await versionsOf(project.id)
  if (!versions.length) {
    throw createError({ statusCode: 409, statusMessage: 'add a version before submitting' })
  }

  const updated = await updateProject(project.id, { status: 'pending' })

  const { body } = await readBody<{ body?: unknown }>(event) ?? {}
  const note = String(body ?? '').trim().slice(0, MAX_BODY)
  if (note) {
    await postMessage({
      projectId: project.id,
      authorId: user.id,
      staff: false,
      body: note,
      status: 'pending',
    })
  }

  await notifyStaff({ kind: 'project_message', actorId: user.id, projectId: project.id })

  return { status: updated.status }
})
