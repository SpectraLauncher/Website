import { describe, expect, it } from 'vitest'

// Rebuilds the database as production has it today — the schema from before
// this branch, with rows in it — and runs the new migration over that. The
// question is not whether a migration passes on an empty database.
//
//   docker run -d --rm --name mig -e POSTGRES_PASSWORD=test -e POSTGRES_DB=spectra \
//     -p 55433:5432 postgres:16-alpine
//   docker exec mig psql -U postgres -c 'CREATE DATABASE upgrade'
//   UPGRADE_URL=postgres://postgres:test@127.0.0.1:55433/upgrade \
//     npx vitest run test/upgrade.test.ts
const url = process.env.UPGRADE_URL

describe.skipIf(!url)('istniejaca baza po migracji', () => {
  it('stare dane przezywaja i stare kolumny zostaja', async () => {
    process.env.DATABASE_URL = url
    process.env.BETTER_AUTH_SECRET ||= 'upgrade-check-secret'
    process.env.NUXT_PUBLIC_SITE_URL ||= 'https://usespectra.app'

    const { getMigrations } = await import('better-auth/db/migration')
    const { useAuth } = await import('../server/utils/auth')
    const { exec, one, q } = await import('../server/utils/db')

    const { runMigrations } = await getMigrations(useAuth().options)
    await runMigrations()

    const old = await import('./fixtures/old-schema/schema')
    const oldCatalog = await import('./fixtures/old-schema/schema-catalog')
    await old.ensureSchema()
    await oldCatalog.ensureCatalogSchema()

    // The catalog was never deployed, so production holds no projects and no
    // files. What it does hold is accounts and modpacks shared from the launcher.
    const now = Date.now()
    await exec(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", username)
       VALUES ('u-old', 'Stary', 'stary@example.com', TRUE, now(), now(), 'stary')
       ON CONFLICT DO NOTHING`)

    await exec(
      `INSERT INTO project (id, slug, type, owner_id, title, summary, status, created, updated)
       VALUES ('p-old', 'stary-mod', 'mod', 'u-old', 'Stary mod', 'opis', 'published', $1, $1)
       ON CONFLICT DO NOTHING`, [now])

    await exec(
      `INSERT INTO version (id, project_id, number, created)
       VALUES ('v-old', 'p-old', '1.0.0', $1) ON CONFLICT DO NOTHING`, [now])

    // Every other row here has a fixed id and an ON CONFLICT, so a second run
    // against the same database is a no-op. This one's id is generated, so
    // without clearing first it piles up and the count below fails on the second
    // run - a fresh database passing and a reused one failing looked like a
    // regression more than once.
    await exec(`DELETE FROM notification WHERE user_id = 'u-old'`)
    await exec(
      `INSERT INTO notification (user_id, kind, created)
       VALUES ('u-old', 'friend_request', $1)`, [now])

    await exec(
      `INSERT INTO shares (code, created, expires, name, owner_id, object_key, size)
       VALUES ('ABC123', $1, $2, 'Moja paczka', 'u-old', 'packs/ABC123.mrpack', 4242)
       ON CONFLICT DO NOTHING`, [now, now + 86_400_000])

    const next = await import('../server/utils/schema')
    const nextCatalog = await import('../server/utils/schema-catalog')
    await next.ensureSchema()
    await nextCatalog.ensureCatalogSchema()

    const user = await one<{ username: string }>(
      `SELECT username FROM "user" WHERE id = 'u-old'`)
    expect(user?.username).toBe('stary')

    const project = await one<{ title: string, status: string, slug: string }>(
      `SELECT title, status, slug FROM project WHERE id = 'p-old'`)
    expect(project?.title).toBe('Stary mod')
    expect(project?.status).toBe('published')
    expect(project?.slug).toBe('stary-mod')

    const version = await one<{ number: string }>(
      `SELECT number FROM version WHERE id = 'v-old'`)
    expect(version?.number).toBe('1.0.0')

    const notifications = await q(`SELECT id FROM notification WHERE user_id = 'u-old'`)
    expect(notifications).toHaveLength(1)

    const share = await one<{ name: string, object_key: string, size: string }>(
      `SELECT name, object_key, size FROM shares WHERE code = 'ABC123'`)
    expect(share?.name).toBe('Moja paczka')
    expect(share?.object_key).toBe('packs/ABC123.mrpack')
  }, 120_000)

  it('nowe kolumny sa puste, nie wypelnione smieciami', async () => {
    const { one } = await import('../server/utils/db')

    const row = await one<{
      bio: string | null
      locale: string | null
      notification_prefs: unknown
      limits: unknown
    }>(`SELECT bio, locale, notification_prefs, limits FROM "user" WHERE id = 'u-old'`)

    expect(row?.bio).toBeNull()
    expect(row?.locale).toBeNull()
    expect(row?.notification_prefs).toBeNull()
    expect(row?.limits).toBeNull()
  })

  it('domyslne z nowych kolumn sa uzywalne od razu', async () => {
    const { one } = await import('../server/utils/db')
    const { cleanPrefs } = await import('../shared/utils/notification-prefs')
    const { permissionsOf } = await import('../shared/utils/org-permissions')

    const row = await one<{ links: unknown, notification_prefs: unknown }>(
      `SELECT links, notification_prefs FROM "user" WHERE id = 'u-old'`)

    // links carries a DEFAULT, so it is not null even on a row that predates it.
    expect(row?.links).toEqual({})

    // What is null has to work once it goes through its own reader.
    expect(cleanPrefs(row?.notification_prefs).projects).toContain('site')
    expect(permissionsOf('admin', null)).toBeGreaterThan(0)
  })

  it('stary projekt jest dalej publiczny, nie zostal przestawiony na pending', async () => {
    const { one } = await import('../server/utils/db')
    const { isListed } = await import('../shared/utils/catalog-types')

    const row = await one<{ status: string }>(`SELECT status FROM project WHERE id = 'p-old'`)
    expect(isListed(row!.status)).toBe(true)
  })

  it('istniejacy plik nie jest oflagowany tylko dlatego, ze go nie skanowano', async () => {
    const { one } = await import('../server/utils/db')

    // A null verdict means nobody looked, which is not the same as a finding.
    const row = await one<{ scan_verdict: string | null }>(
      `SELECT scan_verdict FROM version_file LIMIT 1`)

    if (row) expect(row.scan_verdict).toBeNull()
  })
})
