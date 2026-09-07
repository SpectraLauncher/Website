import { describe, expect, it } from 'vitest'

// createProject writes a row nothing else in the suite writes, and a column list
// that does not line up with its VALUES is not a type error — it is a runtime
// failure on the one statement that starts every project. This runs it against
// a real Postgres.
//
//   docker run -d --rm --name catalogdb -e POSTGRES_PASSWORD=test \
//     -e POSTGRES_DB=spectra -p 55434:5432 postgres:16-alpine
//   CATALOG_DB_URL=postgres://postgres:test@127.0.0.1:55434/spectra \
//     npx vitest run test/catalog-create.test.ts
const url = process.env.CATALOG_DB_URL

describe.skipIf(!url)('tworzenie projektu na prawdziwej bazie', () => {
  it('zapisuje wiersz, deklaracje autorstwa i wybrana widocznosc', async () => {
    process.env.DATABASE_URL = url
    process.env.BETTER_AUTH_SECRET ||= 'catalog-create-secret'
    process.env.NUXT_PUBLIC_SITE_URL ||= 'https://usespectra.app'

    const { getMigrations } = await import('better-auth/db/migration')
    const { useAuth } = await import('../server/utils/auth')
    const { exec, one } = await import('../server/utils/db')

    const { runMigrations } = await getMigrations(useAuth().options)
    await runMigrations()

    const { ensureSchema } = await import('../server/utils/schema')
    const { ensureCatalogSchema } = await import('../server/utils/schema-catalog')
    await ensureSchema()
    await ensureCatalogSchema()

    await exec(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", username)
       VALUES ('u-create', 'Autor', 'autor@example.com', TRUE, now(), now(), 'autor')
       ON CONFLICT (id) DO NOTHING`)

    const { createProject, updateProject } = await import('../server/utils/catalog')
    const { AUTHORSHIP_TERMS } = await import('../server/utils/catalog-licensing')

    const stamp = Date.now()
    const project = await createProject({
      title: 'Widoczny test',
      slug: `create-check-${stamp}`,
      type: 'mod',
      summary: 'Sprawdza, czy INSERT w ogole przechodzi.',
      visibility: 'unlisted',
      authorship: AUTHORSHIP_TERMS,
    }, 'u-create')

    expect(project.id).toBeTruthy()
    expect(project.status).toBe('draft')
    expect(project.requested_status).toBe('unlisted')

    // The declaration is refused when absent, so it has to be readable after.
    const stored = await one<{ authorship_by: string, authorship_terms: string, authorship_at: string }>(
      'SELECT authorship_by, authorship_terms, authorship_at FROM project WHERE id = $1',
      [project.id])

    expect(stored?.authorship_by).toBe('u-create')
    expect(stored?.authorship_terms).toBe(AUTHORSHIP_TERMS)
    expect(Number(stored?.authorship_at)).toBeGreaterThan(0)

    const hidden = await updateProject(project.id, { visibility: 'private' })
    expect(hidden.status).toBe('private')
    expect(hidden.requested_status).toBe('unlisted')

    const back = await updateProject(project.id, { visibility: 'public' })
    expect(back.status).toBe('draft')
    expect(back.requested_status).toBe('published')

    await exec('DELETE FROM project WHERE id = $1', [project.id])
  })

  it('prywatny projekt nie pojawia sie w listingu', async () => {
    process.env.DATABASE_URL = url

    const { exec, q } = await import('../server/utils/db')
    const { createProject } = await import('../server/utils/catalog')
    const { AUTHORSHIP_TERMS } = await import('../server/utils/catalog-licensing')
    const { LISTED_STATUSES } = await import('../shared/utils/catalog-types')

    const stamp = Date.now()
    const project = await createProject({
      title: 'Tylko dla mnie',
      slug: `private-check-${stamp}`,
      type: 'mod',
      visibility: 'private',
      authorship: AUTHORSHIP_TERMS,
    }, 'u-create')

    expect(project.status).toBe('private')

    const listed = await q<{ id: string }>(
      'SELECT id FROM project WHERE id = $1 AND status = ANY($2)',
      [project.id, LISTED_STATUSES as unknown as string[]])

    expect(listed).toHaveLength(0)

    await exec('DELETE FROM project WHERE id = $1', [project.id])
  })

  // The version and file INSERTs had the same defect as the project one, and
  // nothing ran them either: uploading a file failed on the statement itself.
  it('zapisuje wersje wraz z plikiem', async () => {
    process.env.DATABASE_URL = url

    const { exec, one } = await import('../server/utils/db')
    const { attachFile, createProject, createVersion } = await import('../server/utils/catalog')
    const { AUTHORSHIP_TERMS } = await import('../server/utils/catalog-licensing')

    const stamp = Date.now()
    const project = await createProject({
      title: 'Z wersja',
      slug: `version-check-${stamp}`,
      type: 'mod',
      visibility: 'unlisted',
      authorship: AUTHORSHIP_TERMS,
    }, 'u-create')

    const version = await createVersion(project.id, {
      number: '1.2.3',
      name: 'Z wersja 1.2.3',
      channel: 'beta',
      gameVersions: ['1.21.1', '1.21'],
      loaders: ['fabric'],
      meta: { modId: 'zwersja' },
    })

    expect(version.id).toBeTruthy()
    expect(version.number).toBe('1.2.3')
    expect(version.channel).toBe('beta')
    expect(version.game_versions).toEqual(['1.21.1', '1.21'])

    const file = await attachFile(version.id, {
      filename: 'zwersja-1.2.3.jar',
      size: 4096,
      sha1: 'a'.repeat(40),
      sha512: 'b'.repeat(128),
      key: `content/${'b'.repeat(128)}/zwersja-1.2.3.jar`,
      primary: true,
    })

    expect(file.id).toBeTruthy()
    expect(file.sha512).toBe('b'.repeat(128))

    // Re-attaching the same filename updates in place instead of duplicating.
    const again = await attachFile(version.id, {
      filename: 'zwersja-1.2.3.jar',
      size: 8192,
      sha1: 'c'.repeat(40),
      sha512: 'd'.repeat(128),
      key: `content/${'d'.repeat(128)}/zwersja-1.2.3.jar`,
    })

    expect(again.id).toBe(file.id)
    expect(Number(again.size)).toBe(8192)

    const count = await one<{ n: number }>(
      'SELECT count(*)::int AS n FROM version_file WHERE version_id = $1', [version.id])
    expect(count?.n).toBe(1)

    await exec('DELETE FROM project WHERE id = $1', [project.id])
  })
})
