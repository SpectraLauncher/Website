
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!project || !await canSeeThread(project, user)) {
    throw createError({ statusCode: 404, statusMessage: 'no such project' })
  }

  const staff = isAdmin(user)
  const { body } = await readBody<{ body?: unknown }>(event) ?? {}

  // An appeal against a rejection puts the project back in the queue. Without
  // that it is a message nobody is scheduled to read, and the author is told to
  // fix something with no way to have the fix looked at.
  const requeued = !staff && project.status === 'rejected'

  await postMessage({
    projectId: project.id,
    authorId: user.id,
    staff,
    body: cleanBody(body),
    status: requeued ? 'pending' : null,
  })

  if (requeued) await updateProject(project.id, { status: 'pending' })

  // An appeal has to reach whoever can act on it; a staff reply has to reach the
  // author. Same thread, opposite directions.
  if (staff) {
    await notifyOwners(project, { kind: 'project_message', actorId: user.id, projectId: project.id })
  }
  else {
    await notifyStaff({ kind: 'project_message', actorId: user.id, projectId: project.id })
  }

  return { ok: true, status: requeued ? 'pending' : project.status }
})
