
export default defineEventHandler(async (event) => {
  const { org, actor, target } = await memberContext(event)

  if (!has(actor.mask, 'remove_member')) {
    throw createError({ statusCode: 403, statusMessage: 'you cannot remove members here' })
  }
  if (rankOf(target.role) >= actor.rank && !actor.siteAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'that member outranks you' })
  }
  if (target.role === 'owner' && await ownerCount(org.id) < 2) {
    throw createError({ statusCode: 409, statusMessage: 'an organization needs an owner' })
  }

  await removeMember(org.id, target.userId)
  return { members: await orgMembers(org.id) }
})
