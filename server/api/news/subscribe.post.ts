export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown }>(event) ?? {}

  if (!isEmail(body.email)) {
    throw createError({ statusCode: 400, statusMessage: 'that does not look like an address' })
  }

  const viewer = await optionalUser(event)
  const row = await subscribe(body.email, viewer?.id ?? null)

  // Only for an address that has not answered yet: confirming twice is not a
  // thing, and re-sending on every submit would make the form a way to mail
  // somebody repeatedly.
  if (!row.confirmed) {
    const origin = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
    await sendConfirmation(row, origin).catch(e => console.error('[newsletter] confirm', e))
  }

  // Always the same answer, whether the address was already there or not.
  setResponseStatus(event, 202)
  return { ok: true }
})
