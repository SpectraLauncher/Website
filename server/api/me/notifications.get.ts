
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)

  const row = await one<{ prefs: unknown, locale: string | null }>(
    'SELECT notification_prefs AS prefs, locale FROM "user" WHERE id = $1', [me.id])

  return {
    prefs: cleanPrefs(row?.prefs),
    locale: row?.locale ?? null,
    mail: Boolean(process.env.SMTP_HOST),
  }
})
