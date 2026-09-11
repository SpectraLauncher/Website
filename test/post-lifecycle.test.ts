import { describe, expect, it, vi } from 'vitest'

// The blog's whole point is that a picture nobody can see any more stops costing
// money, and that an issue goes out once. Neither is provable without a real
// database — the first is a diff of two JSONB documents, the second is a
// conditional UPDATE. This runs them against Postgres.
//
//   docker run -d --rm --name postdb -e POSTGRES_PASSWORD=test \
//     -e POSTGRES_DB=spectra -p 55435:5432 postgres:16-alpine
//   CATALOG_DB_URL=postgres://postgres:test@127.0.0.1:55435/spectra \
//     npx vitest run test/post-lifecycle.test.ts
const url = process.env.CATALOG_DB_URL

// R2 is not part of what is being checked here; what is, is which addresses the
// code decides to drop. The spy records them.
const dropped: string[] = []

vi.mock('../server/utils/images', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  dropStoredImage: async (address: string) => { dropped.push(address); return true },
}))

const img = (src: string) => ({ type: 'image', attrs: { src, alt: '' } })
const doc = (...content: unknown[]) => ({ type: 'doc', content })
const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })

const CDN = 'https://cdn.usespectra.app/images'

describe.skipIf(!url)('zycie wpisu na prawdziwej bazie', () => {
  it('adres, data publikacji, kasowanie obrazow i wysylka raz', async () => {
    process.env.DATABASE_URL = url
    process.env.BETTER_AUTH_SECRET ||= 'post-lifecycle-secret'
    process.env.NUXT_PUBLIC_SITE_URL ||= 'https://usespectra.app'

    const { getMigrations } = await import('better-auth/db/migration')
    const { useAuth } = await import('../server/utils/auth')
    const { exec, one } = await import('../server/utils/db')

    const { runMigrations } = await getMigrations(useAuth().options)
    await runMigrations()

    const { ensureSchema } = await import('../server/utils/schema')
    const { ensurePostSchema } = await import('../server/utils/schema-post')
    await ensureSchema()
    await ensurePostSchema()

    await exec(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", username)
       VALUES ('u-post', 'Redaktor', 'redaktor@example.com', TRUE, now(), now(), 'redaktor')
       ON CONFLICT (id) DO NOTHING`)

    const { createPost, updatePost, deletePost, postById } = await import('../server/utils/posts')

    // --- an article gets its address from the title -------------------------

    const stamp = Date.now()
    const article = await createPost('article', 'u-post')

    expect(article.status).toBe('draft')
    expect(article.slug).toBeNull()

    const named = await updatePost(article.id, { title: `Pierwszy wpis ${stamp}` })
    expect(named.slug).toBe(`pierwszy-wpis-${stamp}`)

    // A word the routing owns cannot become an article's address.
    await expect(updatePost(article.id, { slug: 'settings' })).rejects.toThrow()

    // Nor can one that is already taken.
    const second = await createPost('article', 'u-post')
    await updatePost(second.id, { title: `Drugi wpis ${stamp}` })
    await expect(updatePost(second.id, { slug: named.slug })).rejects.toThrow()

    // --- the publication date is stamped once -------------------------------

    const live = await updatePost(article.id, { status: 'published' })
    expect(live.status).toBe('published')
    expect(Number(live.published)).toBeGreaterThan(0)

    const edited = await updatePost(article.id, { title: `Poprawiony ${stamp}` })
    expect(Number(edited.published)).toBe(Number(live.published))

    // --- pictures that leave the body leave the bucket -----------------------

    dropped.length = 0

    await updatePost(article.id, {
      body: doc(para('a'), img(`${CDN}/one.png`), img(`${CDN}/two.png`)),
      cover: `${CDN}/cover-a.png`,
    })
    expect(dropped).toEqual([])

    await updatePost(article.id, {
      body: doc(para('a'), img(`${CDN}/two.png`), img(`${CDN}/three.png`)),
      cover: `${CDN}/cover-b.png`,
    })
    expect(dropped).toEqual([`${CDN}/cover-a.png`, `${CDN}/one.png`])

    // --- deleting takes everything it pointed at with it ---------------------

    dropped.length = 0
    await deletePost(article.id)

    expect(dropped.sort()).toEqual([
      `${CDN}/cover-b.png`,
      `${CDN}/three.png`,
      `${CDN}/two.png`,
    ])
    expect(await postById(article.id)).toBeUndefined()

    await deletePost(second.id)

    // --- an issue goes out exactly once --------------------------------------

    const { sendIssue, subscribe } = await import('../server/utils/newsletter')

    await subscribe(`czytelnik-${stamp}@example.com`, null)

    const issue = await createPost('newsletter', 'u-post')
    const ready = await updatePost(issue.id, { title: `Wydanie ${stamp}`, body: doc(para('cześć')) })

    const queued = await sendIssue(ready, 'https://usespectra.app')
    expect(queued).toBeGreaterThan(0)

    // The row it read is the one from before the send, which is exactly the
    // stale object a second click would be holding.
    await expect(sendIssue(ready, 'https://usespectra.app')).rejects.toThrow()

    const sent = await postById(issue.id)
    expect(Number(sent?.sent)).toBeGreaterThan(0)

    const jobs = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM job WHERE kind = 'newsletter'`)
    expect(jobs?.n).toBe(queued)

    await deletePost(issue.id)
    await exec('DELETE FROM newsletter_subscriber WHERE email = $1', [`czytelnik-${stamp}@example.com`])
    await exec(`DELETE FROM job WHERE kind = 'newsletter'`)
  })
})
