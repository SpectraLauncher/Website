
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const body = await readBody<{ prefs?: unknown }>(event) ?? {}

  const prefs = cleanPrefs(body.prefs)
  await exec('UPDATE "user" SET notification_prefs = $2 WHERE id = $1',
    [me.id, JSON.stringify(prefs)])

  return { prefs }
})
