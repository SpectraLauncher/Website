
const DECISIONS: Record<string, 'published' | 'rejected' | 'removed'> = {
  approve: 'published',
  reject: 'rejected',
  remove: 'removed',
}

const NOTIFICATION: Record<string, 'project_approved' | 'project_rejected' | 'project_removed'> = {
  published: 'project_approved',
  rejected: 'project_rejected',
  removed: 'project_removed',
}

export default defineEventHandler(async (event) => {
  const moderator = await requireCatalogWrite(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'id') ?? ''))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  const body = await readBody<{ decision?: unknown, body?: unknown, force?: unknown }>(event) ?? {}
  const status = DECISIONS[String(body.decision ?? '')]
  if (!status) throw createError({ statusCode: 400, statusMessage: 'unknown decision' })

  // A rejection the author cannot read is a dead end — they have nothing to fix
  // and nothing to appeal against.
  const message = status === 'published'
    ? String(body.body ?? '').trim().slice(0, MAX_BODY)
    : cleanBody(body.body)

  if (status === 'published' && body.force !== true) {
    const blocking = await blockingScanIssues(project.id)
    if (blocking) {
      throw createError({
        statusCode: 409,
        statusMessage: `${blocking} file(s) are flagged or not scanned yet`,
      })
    }
  }

  const updated = await updateProject(project.id, { status })

  if (message) {
    await postMessage({
      projectId: project.id,
      authorId: moderator.id,
      staff: true,
      body: message,
      status,
    })
  }

  await notifyOwners(project, {
    kind: NOTIFICATION[status]!,
    actorId: moderator.id,
    projectId: project.id,
  })

  return { project: fullProject(updated, [], []) }
})
