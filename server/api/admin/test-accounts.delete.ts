
const TEST_DOMAIN = '@example.com'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const targets = await q<{ id: string, email: string }>(
    'SELECT id, email FROM "user" WHERE lower(email) LIKE $1',
    [`%${TEST_DOMAIN}`],
  )

  const failed: string[] = []
  for (const target of targets) {
    try {
      await deleteAccount(target.id)
    } catch (e) {
      console.error('[admin] could not delete', target.email, e)
      failed.push(target.email)
    }
  }

  return { deleted: targets.length - failed.length, failed }
})
