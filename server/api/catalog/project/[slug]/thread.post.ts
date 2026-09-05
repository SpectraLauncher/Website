
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!project || !await canSeeThread(project, user)) {
    throw createError({ statusCode: 404, statusMessage: 'no such project' })
  }

  const staff = isAdmin(user)
  const { body } = await readBody<{ body?: unknown }>(event) ?? {}

  await postMessage({
    projectId: project.id,
    authorId: user.id,
    staff,
    body: cleanBody(body),
  })

  // An appeal has to reach whoever can act on it; a staff reply has to reach the
  // author. Same thread, opposite directions.
  if (staff) {
    await notifyOwners(project, { kind: 'project_message', actorId: user.id, projectId: project.id })
  }
  else {
    await notifyStaff({ kind: 'project_message', actorId: user.id, projectId: project.id })
  }

  return { ok: true }
})
