
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const { locale } = await readBody<{ locale?: unknown }>(event) ?? {}

  if (!MAIL_LOCALES.includes(String(locale))) {
    throw createError({ statusCode: 400, statusMessage: 'unknown language' })
  }

  await exec('UPDATE "user" SET locale = $2 WHERE id = $1', [me.id, String(locale)])
  return { locale }
})
