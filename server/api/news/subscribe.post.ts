export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown }>(event) ?? {}

  if (!isEmail(body.email)) {
    throw createError({ statusCode: 400, statusMessage: 'that does not look like an address' })
  }

  const viewer = await optionalUser(event)
  await subscribe(body.email, viewer?.id ?? null)

  // Always the same answer, whether the address was already there or not.
  setResponseStatus(event, 202)
  return { ok: true }
})
