export default defineEventHandler(async (event) => {
  const moderator = await requireModeration(event)

  const version = await versionById(String(getRouterParam(event, 'id') ?? ''), true)
  if (!version?.held) throw createError({ statusCode: 404, statusMessage: 'no such version' })

  const project = await projectByIdOrSlug(version.project_id)
  if (!project) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  const body = await readBody<{ decision?: unknown, body?: unknown, review?: unknown }>(event) ?? {}
  const decision = body.decision === 'approve' ? 'approve' : body.decision === 'reject' ? 'reject' : null
  if (!decision) throw createError({ statusCode: 400, statusMessage: 'unknown decision' })

  if (decision === 'approve' && !addonReviewDone(body.review)) {
    throw createError({ statusCode: 409, statusMessage: 'finish the addon review first' })
  }

  const message = decision === 'approve'
    ? String(body.body ?? '').trim().slice(0, MAX_BODY)
    : cleanBody(body.body)

  if (decision === 'approve') await releaseVersion(version.id)
  else await deleteVersion(version.id)

  if (message) {
    await postMessage({ projectId: project.id, authorId: moderator.id, staff: true, body: message, status: null })
  }

  await recordStaffAction({
    actor: moderator,
    action: `version.${decision}`,
    subjectKind: 'project',
    subjectId: project.id,
    summary: `${project.title || project.slug} ${version.number} → ${decision === 'approve' ? 'released' : 'rejected'}`,
    meta: { slug: project.slug, version: version.number, review: body.review },
  })

  await notifyOwners(project, { kind: 'project_message', actorId: moderator.id, projectId: project.id })

  return { ok: true }
})
