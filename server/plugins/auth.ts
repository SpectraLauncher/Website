import { getMigrations } from 'better-auth/db/migration'
import { ensureAccountIssuer, ensureSchema } from '../utils/schema'
import { backfillUsernames } from '../utils/username'

export default defineNitroPlugin(async () => {
  if (import.meta.prerender) return

  try {
    await ensureAccountIssuer()

    const { runMigrations } = await getMigrations(useAuth().options)
    await runMigrations()
    await ensureSchema()

    const filled = await backfillUsernames()
    if (filled) console.info(`[db] gave a username to ${filled} account(s)`)
  } catch (e) {
    console.error('[db] migration failed', e)
  }
})
