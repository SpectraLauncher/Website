export default defineEventHandler(async (event) => {
  const staff = await requireOwner(event)

  const body = await readBody<Partial<PlatformPolicy>>(event) ?? {}
  const before = await platformPolicy()

  const patch = Object.fromEntries(
    POLICY_KEYS.filter(key => typeof body[key] === 'boolean').map(key => [key, body[key]]),
  )

  if (!Object.keys(patch).length) {
    throw createError({ statusCode: 400, statusMessage: 'nothing to change' })
  }

  const policy = await savePolicy(patch)

  const changed = POLICY_KEYS
    .filter(key => before[key] !== policy[key])
    .map(key => `${key}: ${before[key]} → ${policy[key]}`)

  if (changed.length) {
    await recordStaffAction({
      actor: staff,
      action: 'platform.policy',
      subjectKind: 'platform',
      summary: changed.join(', '),
      meta: { before, after: policy },
    })
  }

  return { policy }
})
