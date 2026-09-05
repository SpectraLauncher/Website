import { describe, expect, it } from 'vitest'

// Uruchamia prawdziwa migracje na prawdziwej bazie, w tej samej kolejnosci co
// server/plugins/auth.ts przy starcie. Bez MIG_URL test sie pomija, wiec
// zwykly przebieg nie potrzebuje Postgresa:
//
//   docker run -d --rm --name mig -e POSTGRES_PASSWORD=test -e POSTGRES_DB=spectra \
//     -p 55433:5432 postgres:16-alpine
//   MIG_URL=postgres://postgres:test@127.0.0.1:55433/spectra npx vitest run test/migration.test.ts
const url = process.env.MIG_URL

describe.skipIf(!url)('migracja na czystej bazie', () => {
  it('przechodzi i jest idempotentna', async () => {
    process.env.DATABASE_URL = url
    process.env.BETTER_AUTH_SECRET ||= 'migration-check-secret'
    process.env.NUXT_PUBLIC_SITE_URL ||= 'https://usespectra.app'

    const { getMigrations } = await import('better-auth/db/migration')
    const { useAuth } = await import('../server/utils/auth')
    const { ensureAccountIssuer, ensureSchema } = await import('../server/utils/schema')
    const { ensureCatalogSchema } = await import('../server/utils/schema-catalog')
    const { q } = await import('../server/utils/db')

    await ensureAccountIssuer()
    const { runMigrations } = await getMigrations(useAuth().options)
    await runMigrations()
    await ensureSchema()
    await ensureCatalogSchema()

    // Kazdy start serwera uruchamia to ponownie na bazie, ktora juz ma tabele.
    // Drugi przebieg jest wlasciwym testem, nie pierwszy.
    await ensureSchema()
    await ensureCatalogSchema()

    const tables = await q<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)
    const names = tables.map(t => t.tablename)

    // Kazda tabela, ktora ta sesja dolozyla, plus kregoslup katalogu.
    for (const table of [
      'project', 'version', 'version_file', 'collection', 'collection_project',
      'project_comment', 'project_message', 'project_member', 'report',
      'payout_ledger', 'payout', 'stored_image', 'access_token', 'user_block',
      'job', 'seller', 'purchase',
    ]) {
      expect(names, table).toContain(table)
    }
  }, 120_000)

  it('kolumny dolozone alterem naprawde sa', async () => {
    const { q } = await import('../server/utils/db')

    const columns = await q<{ table_name: string, column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public'`)

    const has = (table: string, column: string) =>
      columns.some(c => c.table_name === table && c.column_name === column)

    for (const [table, column] of [
      ['user', 'bio'], ['user', 'links'], ['user', 'locale'],
      ['user', 'notification_prefs'], ['user', 'limits'],
      ['member', 'permissions'],
      ['notification', 'project_id'],
      ['project_message', 'report_id'],
      ['collection', 'kind'],
      ['version_file', 'scan_verdict'],
    ] as const) {
      expect(has(table, column), `${table}.${column}`).toBe(true)
    }
  })

  it('project_id w watku moderacji jest juz opcjonalne', async () => {
    const { q } = await import('../server/utils/db')

    const rows = await q<{ is_nullable: string }>(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_name = 'project_message' AND column_name = 'project_id'`)

    expect(rows[0]?.is_nullable).toBe('YES')
  })
})
