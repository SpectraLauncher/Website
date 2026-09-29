import { describe, expect, it } from 'vitest'

// Runs the real migration against a real database, in the order
// server/plugins/auth.ts uses at boot. Without MIG_URL it skips, so an ordinary
// run needs no Postgres:
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

    // Every boot runs this again against a database that already has the
    // tables, so the second pass is the real test.
    await ensureSchema()
    await ensureCatalogSchema()

    const tables = await q<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)
    const names = tables.map(t => t.tablename)


    for (const table of [
      'project', 'version', 'version_file', 'collection', 'collection_project',
      'project_comment', 'project_message', 'project_member', 'report',
      'stored_image', 'access_token', 'user_block',
      'job', 'platform_setting',
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

  // The baseline is additive and cannot express a DROP; these steps can, which
  // is the whole reason they exist. Up, down and up again, because a down that
  // is never run is a down nobody knows is broken.
  it('krok destrukcyjny idzie w obie strony', async () => {
    const { usePool } = await import('../server/utils/db')
    const { appliedMigrations, rollbackMigration, runSchemaMigrations }
      = await import('../server/utils/migrations')

    const pool = usePool()
    const tables = async () => {
      const res = await pool.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)
      return res.rows.map(r => r.tablename)
    }

    await runSchemaMigrations(pool)
    expect(await appliedMigrations(pool)).toContain('001-drop-express-payment-tables')
    expect(await tables()).not.toContain('seller')

    await rollbackMigration(pool, '001-drop-express-payment-tables')
    expect(await appliedMigrations(pool)).not.toContain('001-drop-express-payment-tables')
    for (const table of ['seller', 'purchase', 'payout_ledger', 'payout']) {
      expect(await tables(), table).toContain(table)
    }

    await runSchemaMigrations(pool)
    expect(await tables()).not.toContain('purchase')
  }, 60_000)

  it('003 zdejmuje platnosci i oddaje je w down', async () => {
    const { usePool } = await import('../server/utils/db')
    const { appliedMigrations, rollbackMigration, runSchemaMigrations }
      = await import('../server/utils/migrations')

    const pool = usePool()
    const tables = async () => (await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)).rows.map(r => r.tablename)
    const projectColumns = async () => (await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'project'`))
      .rows.map(r => r.column_name)
    const payment = ['connected_account', 'org_split', 'sale', 'sale_item', 'ledger_entry',
      'entitlement', 'webhook_event', 'payout_request']

    await runSchemaMigrations(pool)
    expect(await appliedMigrations(pool)).toContain('003-drop-payments')
    for (const table of payment) expect(await tables(), table).not.toContain(table)
    expect(await projectColumns()).not.toContain('price')

    await rollbackMigration(pool, '003-drop-payments')
    for (const table of payment) expect(await tables(), table).toContain(table)
    expect(await projectColumns()).toContain('price')

    await runSchemaMigrations(pool)
    for (const table of payment) expect(await tables(), table).not.toContain(table)
  }, 60_000)

  // The project page reads the featured image as its backdrop, so two of them
  // would make the backdrop depend on which row came back first.
  it('tylko jedno zdjecie w galerii moze byc wyroznione', async () => {
    const { exec, q } = await import('../server/utils/db')
    const { updateGalleryImage } = await import('../server/utils/catalog')

    const now = Date.now()
    await exec(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", username)
       VALUES ('u-gal', 'Gal', 'gal@example.com', TRUE, now(), now(), 'gal')
       ON CONFLICT DO NOTHING`)
    await exec(
      `INSERT INTO project (id, slug, type, owner_id, title, status, created, updated)
       VALUES ('p-gal', 'gal-mod', 'mod', 'u-gal', 'Gal', 'published', $1, $1)
       ON CONFLICT DO NOTHING`, [now])

    for (const [id, ordering] of [['g1', 0], ['g2', 1], ['g3', 2]] as const) {
      await exec(
        `INSERT INTO project_gallery (id, project_id, url, ordering, created)
         VALUES ($1, 'p-gal', $2, $3, $4) ON CONFLICT DO NOTHING`,
        [id, `/g/${id}.webp`, ordering, now])
    }

    const featured = async () => (await q<{ id: string }>(
      `SELECT id FROM project_gallery WHERE project_id = 'p-gal' AND featured ORDER BY id`))
      .map(row => row.id)

    await updateGalleryImage('g1', { featured: true })
    expect(await featured()).toEqual(['g1'])

    // The one that used to fail: marking a second left both set.
    await updateGalleryImage('g2', { featured: true })
    expect(await featured()).toEqual(['g2'])

    // Editing something else must not disturb which one is featured.
    await updateGalleryImage('g3', { title: 'trzecie' })
    expect(await featured()).toEqual(['g2'])

    await updateGalleryImage('g2', { featured: false })
    expect(await featured()).toEqual([])
  })

  it('baza sama nie wpusci drugiego wyroznionego', async () => {
    const { q } = await import('../server/utils/db')

    const rows = await q<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'uniq_gallery_featured'`)

    expect(rows[0]?.indexdef).toMatch(/UNIQUE/)
    expect(rows[0]?.indexdef).toMatch(/WHERE featured/)
  })

  it('drugie przejscie nie robi nic', async () => {
    const { usePool } = await import('../server/utils/db')
    const { runSchemaMigrations } = await import('../server/utils/migrations')

    expect(await runSchemaMigrations(usePool())).toEqual([])
  })
})
