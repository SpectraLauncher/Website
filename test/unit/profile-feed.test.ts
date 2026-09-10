import { afterEach, describe, expect, it, vi } from 'vitest'

import { profileFeed } from '../../server/utils/profile-feed'

const g = globalThis as Record<string, unknown>

afterEach(() => { delete g.q })

const at = (iso: string) => Date.parse(iso)

/** Answers each of the four queries by the table it names. */
function db(rows: {
  version?: unknown[]
  project?: unknown[]
  comment?: unknown[]
  member?: unknown[]
}) {
  return vi.fn(async (sql: string) => {
    if (sql.includes('FROM version v')) return rows.version ?? []
    if (sql.includes('FROM project_comment')) return rows.comment ?? []
    if (sql.includes('FROM project')) return rows.project ?? []
    return rows.member ?? []
  })
}

const RELEASE = {
  number: '1.2.0',
  created: at('2026-09-03T12:00:00Z'),
  game_versions: ['1.21.1'],
  loaders: ['neoforge'],
  title: 'MKT Essentials',
  slug: 'mkt-essentials',
  type: 'mod',
}

describe('feed profilu', () => {
  it('bez katalogu nie pyta bazy o nic', async () => {
    const q = db({})
    g.q = q

    expect(await profileFeed('u1', false)).toEqual([])
    expect(q).not.toHaveBeenCalled()
  })

  it('sortuje wszystkie zrodla od najnowszego', async () => {
    g.q = db({
      version: [RELEASE],
      project: [{
        title: 'MKT Essentials',
        slug: 'mkt-essentials',
        type: 'mod',
        published: at('2026-08-01T09:00:00Z'),
      }],
      comment: [{
        body: 'dziala na 200 graczach',
        created: at('2026-09-05T08:00:00Z'),
        title: 'Terralith',
        slug: 'terralith',
        type: 'mod',
      }],
      member: [{
        name: 'Stardust',
        slug: 'stardust',
        role: 'owner',
        createdAt: at('2026-07-01T09:00:00Z'),
      }],
    })

    const feed = await profileFeed('u1', true)

    expect(feed.map(e => e.kind)).toEqual(['comment', 'release', 'publish', 'org'])
    expect(feed[1]).toMatchObject({ path: '/mod/mkt-essentials', version: '1.2.0' })
  })

  it('nie zna wpisu o graniu', async () => {
    g.q = db({ version: [RELEASE] })

    const feed = await profileFeed('u1', true)

    expect(feed.map(e => e.kind)).toEqual(['release'])
  })

  it('sciaga dlugi komentarz do jednej linii', async () => {
    g.q = db({
      comment: [{
        body: `  wielo\n  linijkowy   ${'a'.repeat(200)}`,
        created: at('2026-09-05T08:00:00Z'),
        title: 'Terralith',
        slug: 'terralith',
        type: 'mod',
      }],
    })

    const [event] = await profileFeed('u1', true)

    expect(event!.kind).toBe('comment')
    const { excerpt } = event as Extract<typeof event, { kind: 'comment' }>
    expect(excerpt).toHaveLength(140)
    expect(excerpt.endsWith('…')).toBe(true)
    expect(excerpt.startsWith('wielo linijkowy ')).toBe(true)
  })

  it('nie przepuszcza wpisu bez sensownej daty', async () => {
    g.q = db({ version: [{ ...RELEASE, created: null }] })

    expect(await profileFeed('u1', true)).toEqual([])
  })

  it('tnie do dwunastu wpisow', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      ...RELEASE,
      created: at('2026-09-03T12:00:00Z') + i,
    }))
    g.q = db({ version: many, project: [], comment: [], member: [] })

    expect(await profileFeed('u1', true)).toHaveLength(12)
  })
})
