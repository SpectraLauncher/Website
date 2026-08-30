import { getMigrations } from 'better-auth/db/migration'
import { ensureAccountIssuer, ensureAdminRole, ensureSchema } from '../utils/schema'
import { backfillUsernames } from '../utils/username'

export default defineNitroPlugin(async () => {
  if (import.meta.prerender) return

  // A boot problem here means the server would run on a half-formed schema, or
  // with e-mail verification silently off. Both are worse than not starting.
  const fatal = (message: string, cause?: unknown) => {
    console.error(`[boot] ${message}`, cause ?? '')
    if (!import.meta.dev) process.exit(1)
  }

  if (!import.meta.dev && !process.env.RESEND_API_KEY) {
    return fatal('RESEND_API_KEY is not set, so better-auth would stop requiring e-mail '
      + 'verification and anyone could register any address. Refusing to start.')
  }

  try {
    await ensureAccountIssuer()

    const { runMigrations } = await getMigrations(useAuth().options)
    await runMigrations()
    await ensureSchema()

    const promoted = await ensureAdminRole()
    if (promoted) console.info(`[db] promoted ${promoted} account(s) to admin from ADMIN_EMAILS`)

    const filled = await backfillUsernames()
    if (filled) console.info(`[db] gave a username to ${filled} account(s)`)
  } catch (e) {
    fatal('database migration failed — refusing to serve on a half-formed schema', e)
  }
})
