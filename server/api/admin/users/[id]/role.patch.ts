/**
 * Hand somebody a role, or take it away.
 *
 * Owner only, and two things it refuses even then: the last owner cannot be
 * demoted, and an owner cannot be demoted by anybody but themselves. Between
 * them those keep the ladder from losing its top — an empty owner slot cannot
 * be refilled from inside the panel.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireOwner(event)

  const id = String(getRouterParam(event, 'id') ?? '')
  const body = await readBody<{ role?: unknown }>(event) ?? {}

  // The empty string is how a role is taken away, so it is valid input.
  const role = body.role === null || body.role === '' ? null : body.role
  if (role !== null && !isStaffRole(role)) {
    throw createError({ statusCode: 400, statusMessage: 'unknown role' })
  }

  const target = await one<{ id: string, username: string | null, role: string | null }>(
    'SELECT id, username, role FROM "user" WHERE id = $1', [id])
  if (!target) throw createError({ statusCode: 404, statusMessage: 'no such user' })

  if (target.role === role) return { user: { id: target.id, role } }

  if (isOwner(target) && target.id !== staff.id) {
    throw createError({ statusCode: 409, statusMessage: 'an owner can only be stepped down by themselves' })
  }

  if (isOwner(target) && !isOwner({ role })) {
    const others = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM "user" WHERE role = 'owner' AND id <> $1`, [id])
    if (!others?.n) {
      throw createError({ statusCode: 409, statusMessage: 'the last owner cannot step down' })
    }
  }

  await exec('UPDATE "user" SET role = $1 WHERE id = $2', [role, id])

  // Losing a role has to reach the open tabs, not the next sign-in.
  if (staffRank({ role }) < staffRank(target)) {
    await exec('DELETE FROM session WHERE "userId" = $1', [id])
  }

  await recordStaffAction({
    actor: staff,
    action: role ? 'role.grant' : 'role.revoke',
    subjectKind: 'user',
    subjectId: id,
    summary: `${target.username ?? id}: ${target.role ?? 'brak'} → ${role ?? 'brak'}`,
    meta: { from: target.role, to: role },
  })

  return { user: { id: target.id, role } }
})
