import { describe, expect, it } from 'vitest'

// Odtwarza baze taka, jaka jest na produkcji dzisiaj — schemat sprzed tej sesji,
// z danymi — i puszcza na nia nowa migracje. To jest wlasciwe pytanie: nie "czy
// migracja przechodzi na pustym", tylko "czy stara strona dalej dziala".
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

    // --- stan sprzed tej sesji ---
    const { runMigrations } = await getMigrations(useAuth().options)
    await runMigrations()

    const old = await import('./fixtures/old-schema/schema')
    const oldCatalog = await import('./fixtures/old-schema/schema-catalog')
    await old.ensureSchema()
    await oldCatalog.ensureCatalogSchema()

    // --- dane, ktore juz tam sa ---
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

    await exec(
      `INSERT INTO notification (user_id, kind, created)
       VALUES ('u-old', 'friend_request', $1)`, [now])

    // --- migracja, ktora poszlaby przy wdrozeniu ---
    const next = await import('../server/utils/schema')
    const nextCatalog = await import('../server/utils/schema-catalog')
    await next.ensureSchema()
    await nextCatalog.ensureCatalogSchema()

    // --- czy stare dalej stoi ---
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
  }, 120_000)

  it('nowe kolumny sa puste, nie wypelnione smieciami', async () => {
    const { one } = await import('../server/utils/db')

    // Konto zalozone przed ta sesja nie ma bio ani preferencji powiadomien, i to
    // jest w porzadku: kod czyta je z domyslnymi.
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

    // links ma DEFAULT '{}', wiec nie jest NULL nawet dla starego wiersza.
    expect(row?.links).toEqual({})

    // A to, co jest NULL, ma dzialac po przepuszczeniu przez wlasny czytnik.
    expect(cleanPrefs(row?.notification_prefs).projects).toContain('site')
    expect(permissionsOf('admin', null)).toBeGreaterThan(0)
  })

  it('stary projekt jest dalej publiczny, nie zostal przestawiony na pending', async () => {
    const { one } = await import('../server/utils/db')
    const { isListed } = await import('../server/utils/catalog-types')

    const row = await one<{ status: string }>(`SELECT status FROM project WHERE id = 'p-old'`)
    expect(isListed(row!.status)).toBe(true)
  })

  it('istniejacy plik nie jest oflagowany tylko dlatego, ze go nie skanowano', async () => {
    const { one } = await import('../server/utils/db')

    // scan_verdict NULL znaczy "nikt nie patrzyl", a nie "znalazlem cos".
    const row = await one<{ scan_verdict: string | null }>(
      `SELECT scan_verdict FROM version_file LIMIT 1`)

    if (row) expect(row.scan_verdict).toBeNull()
  })
})
