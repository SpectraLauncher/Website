
export default defineEventHandler(async (event) => {
  const { org, actor, target } = await memberContext(event)

  if (!has(actor.mask, 'edit_member')) {
    throw createError({ statusCode: 403, statusMessage: 'you cannot edit members here' })
  }

  const body = await readBody<{ role?: unknown, permissions?: unknown }>(event) ?? {}
  const role = body.role === undefined ? target.role : String(body.role)

  if (!isOrgRole(role)) throw createError({ statusCode: 400, statusMessage: 'unknown role' })

  // You may not hand somebody a rank you do not outrank yourself, and you may
  // not touch somebody who already stands level with you.
  if (rankOf(target.role) >= actor.rank && !actor.siteAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'that member outranks you' })
  }
  if (rankOf(role) > actor.rank) {
    throw createError({ statusCode: 403, statusMessage: 'you cannot grant a role above your own' })
  }

  let mask: number | null = null
  if (body.permissions !== undefined) {
    mask = listToMask(body.permissions)
    if (!canGrant(actor.mask, mask)) {
      throw createError({ statusCode: 403, statusMessage: 'you cannot grant what you do not have' })
    }
  }

  // Handing the last owner's chair away would leave the organization ownerless.
  if (target.role === 'owner' && role !== 'owner' && await ownerCount(org.id) < 2) {
    throw createError({ statusCode: 409, statusMessage: 'an organization needs an owner' })
  }

  if (role !== target.role) await setMemberRole(org.id, target.userId, role)
  if (body.permissions !== undefined) await setMemberPermissions(org.id, target.userId, mask)

  return { members: await orgMembers(org.id) }
})
