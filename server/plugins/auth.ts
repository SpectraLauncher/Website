import { getMigrations } from 'better-auth/db/migration'
import { usePool } from '../utils/db'
import { runSchemaMigrations } from '../utils/migrations'
import { ensureAccountIssuer, ensureAdminRole, ensureSchema } from '../utils/schema'
import { ensureCatalogSchema } from '../utils/schema-catalog'
import { backfillUsernames } from '../utils/username'

export default defineNitroPlugin(async () => {
  if (import.meta.prerender) return

  // A boot problem here means the server would run on a half-formed schema, or
  // with e-mail verification silently off. Both are worse than not starting.
  const fatal = (message: string, cause?: unknown) => {
    console.error(`[boot] ${message}`, cause ?? '')
    if (!import.meta.dev) process.exit(1)
  }

  if (!import.meta.dev && !process.env.SMTP_HOST) {
    return fatal('SMTP_HOST is not set, so better-auth would stop requiring e-mail '
      + 'verification and anyone could register any address. Refusing to start.')
  }

  try {
    await ensureAccountIssuer()

    const { runMigrations } = await getMigrations(useAuth().options)
    await runMigrations()
    await ensureSchema()
    await ensureCatalogSchema()

    // After the baseline, never before: a step that alters a table needs the
    // table to be there.
    const applied = await runSchemaMigrations(usePool())
    if (applied.length) console.info(`[db] applied migration(s): ${applied.join(', ')}`)

    const promoted = await ensureAdminRole()
    if (promoted) console.info(`[db] promoted ${promoted} account(s) to admin from ADMIN_EMAILS`)

    const filled = await backfillUsernames()
    if (filled) console.info(`[db] gave a username to ${filled} account(s)`)
  } catch (e) {
    fatal('database migration failed — refusing to serve on a half-formed schema', e)
  }
})
