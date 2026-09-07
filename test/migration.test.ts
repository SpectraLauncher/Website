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
      'job', 'platform_setting', 'connected_account', 'org_split', 'sale', 'sale_item',
      'ledger_entry', 'entitlement', 'webhook_event', 'payout_request',
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

  it('tabele platnosci maja kolumny, na ktorych stoi reszta', async () => {
    const { q } = await import('../server/utils/db')

    const rows = await q<{ table_name: string, column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public'`)

    const has = (table: string, column: string) =>
      rows.some(r => r.table_name === table && r.column_name === column)

    for (const [table, column] of [
      ['connected_account', 'user_id'], ['connected_account', 'stripe_account'],
      ['connected_account', 'transfers_enabled'], ['connected_account', 'commission_override_bps'],
      ['org_split', 'share_bps'],
      ['sale', 'intent_id'], ['sale', 'charge_id'], ['sale', 'consent_at'],
      ['sale_item', 'rate_bps'], ['sale_item', 'min_fee_minor'], ['sale_item', 'title'],
      ['ledger_entry', 'state'], ['ledger_entry', 'share_bps'], ['ledger_entry', 'transfer_id'],
      ['entitlement', 'sale_item_id'], ['entitlement', 'revoked'],
      ['webhook_event', 'payload'], ['webhook_event', 'processed'],
      ['payout_request', 'payout_id'],
    ] as const) {
      expect(has(table, column), `${table}.${column}`).toBe(true)
    }
  })

  // An order with no recorded waiver is one we could not refuse to refund.
  it('zgoda na natychmiastowa dostawe jest wymagana przy zamowieniu', async () => {
    const { q } = await import('../server/utils/db')

    const rows = await q<{ column_name: string, is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_name = 'sale' AND column_name IN ('consent_at', 'consent_terms')`)

    expect(rows).toHaveLength(2)
    for (const row of rows) expect(row.is_nullable, row.column_name).toBe('NO')
  })

  it('jedno uprawnienie na osobe i projekt', async () => {
    const { q } = await import('../server/utils/db')

    const rows = await q<{ column_name: string }>(
      `SELECT a.attname AS column_name
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       WHERE i.indrelid = 'entitlement'::regclass AND i.indisprimary`)

    expect(rows.map(r => r.column_name).sort()).toEqual(['project_id', 'user_id'])
  })

  it('konto sprzedawcy jest jedno na osobe i jedno na konto Stripe', async () => {
    const { q } = await import('../server/utils/db')

    const defs = (await q<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'connected_account'`))
      .map(r => r.indexdef).join('\n')

    expect(defs).toMatch(/UNIQUE.*\(user_id\)/)
    expect(defs).toMatch(/UNIQUE.*\(stripe_account\)/)
  })

  // Two deliveries of one event must not pay the same person twice for one item.
  it('ta sama pozycja nie moze trafic do ksiegi dwa razy', async () => {
    const { q } = await import('../server/utils/db')

    const rows = await q<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
       WHERE tablename = 'ledger_entry' AND indexname = 'uniq_ledger_sale'`)

    expect(rows[0]?.indexdef).toMatch(/UNIQUE/)
    expect(rows[0]?.indexdef).toMatch(/sale_item_id, user_id, kind/)
  })

  // 'n' is SET NULL: the row survives a removed project, the pointer does not.
  it('usuniety projekt nie kasuje tego, za co ktos zaplacil', async () => {
    const { q } = await import('../server/utils/db')

    const rows = await q<{ confdeltype: string }>(
      `SELECT c.confdeltype FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
       WHERE c.conrelid = 'sale_item'::regclass AND c.contype = 'f'
         AND a.attname = 'project_id'`)

    expect(rows[0]?.confdeltype).toBe('n')
  })

  // Onboarding is deferred, so somebody can be owed money before they have a
  // Stripe account at all. A ledger keyed on the connected account could not
  // express that.
  it('ksiega wisi na uzytkowniku, nie na koncie Stripe', async () => {
    const { q } = await import('../server/utils/db')

    const names = (await q<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'ledger_entry'`)).map(r => r.column_name)

    expect(names).toContain('user_id')
    expect(names).not.toContain('seller_id')
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
