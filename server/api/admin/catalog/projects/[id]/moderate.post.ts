
// Approval sends the project where its author asked it to go, which is not
// always public — an unlisted project is reviewed the same way and then stays
// off the listings.
const DECISIONS = ['approve', 'reject', 'remove'] as const

const NOTIFICATION = {
  approve: 'project_approved',
  reject: 'project_rejected',
  remove: 'project_removed',
} as const

export default defineEventHandler(async (event) => {
  const moderator = await requireCatalogWrite(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'id') ?? ''))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  const body = await readBody<{ decision?: unknown, body?: unknown, force?: unknown }>(event) ?? {}
  const decision = String(body.decision ?? '')
  if (!(DECISIONS as readonly string[]).includes(decision)) {
    throw createError({ statusCode: 400, statusMessage: 'unknown decision' })
  }

  const approved = project.requested_status === 'unlisted' ? 'unlisted' : 'published'
  const status = decision === 'approve' ? approved : decision === 'reject' ? 'rejected' : 'removed'

  // A rejection the author cannot read is a dead end — they have nothing to fix
  // and nothing to appeal against.
  const message = decision === 'approve'
    ? String(body.body ?? '').trim().slice(0, MAX_BODY)
    : cleanBody(body.body)

  if (decision === 'approve' && body.force !== true) {
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
    kind: NOTIFICATION[decision as keyof typeof NOTIFICATION],
    actorId: moderator.id,
    projectId: project.id,
  })

  return { project: fullProject(updated, [], []) }
})
