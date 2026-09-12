/**
 * Take a submission, or put it back.
 *
 * Deliberately not a lock: another moderator can still decide the same project.
 * Two people opening the same queue need to know somebody is already on a row,
 * not to be locked out of it — a lock nobody can break becomes a stuck queue
 * the moment its holder goes on holiday.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireModeration(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'id') ?? ''))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  const body = await readBody<{ claim?: unknown }>(event) ?? {}
  const claiming = body.claim !== false

  await exec(
    'UPDATE project SET reviewer_id = $2, reviewer_at = $3 WHERE id = $1',
    [project.id, claiming ? staff.id : null, claiming ? Date.now() : null],
  )

  return {
    reviewer: claiming
      ? { id: staff.id, username: staff.username ?? null, at: Date.now() }
      : null,
  }
})
