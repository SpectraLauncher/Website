import { afterEach, describe, expect, it, vi } from 'vitest'

import { profileFeed } from '../../server/utils/profile-feed'

const g = globalThis as Record<string, unknown>

afterEach(() => { delete g.q })

const day = (date: string, seconds: number, launches = 1) => ({ day: date, launches, seconds })

describe('feed profilu', () => {
  it('bez katalogu nie pyta bazy o nic', async () => {
    const q = vi.fn()
    g.q = q

    const feed = await profileFeed('u1', [day('2026-09-01', 3600)], false)

    expect(q).not.toHaveBeenCalled()
    expect(feed).toHaveLength(1)
    expect(feed[0]!.kind).toBe('play')
  })

  it('pomija dni bez rozgrywki', async () => {
    g.q = vi.fn()

    const feed = await profileFeed('u1', [day('2026-09-01', 0), day('2026-09-02', 60)], false)

    expect(feed).toHaveLength(1)
    expect(feed[0]).toMatchObject({ kind: 'play', seconds: 60 })
  })

  it('miesza wydania z graniem i sortuje od najnowszego', async () => {
    const at = (iso: string) => Date.parse(iso)

    g.q = vi.fn(async (sql: string) => {
      if (sql.includes('FROM version v')) {
        return [{
          number: '1.2.0',
          created: at('2026-09-03T12:00:00Z'),
          game_versions: ['1.21.1'],
          loaders: ['neoforge'],
          title: 'MKT Essentials',
          slug: 'mkt-essentials',
          type: 'mod',
        }]
      }
      if (sql.includes('FROM project')) {
        return [{
          title: 'MKT Essentials',
          slug: 'mkt-essentials',
          type: 'mod',
          published: at('2026-08-01T09:00:00Z'),
        }]
      }
      return [{
        name: 'Stardust',
        slug: 'stardust',
        role: 'owner',
        createdAt: at('2026-07-01T09:00:00Z'),
      }]
    })

    const feed = await profileFeed('u1', [day('2026-09-02', 7200)], true)

    expect(feed.map(e => e.kind)).toEqual(['release', 'play', 'publish', 'org'])
    expect(feed[0]).toMatchObject({ kind: 'release', path: '/mod/mkt-essentials', version: '1.2.0' })
  })

  it('nie przepuszcza wpisu bez sensownej daty', async () => {
    g.q = vi.fn(async (sql: string) => (sql.includes('FROM version v')
      ? [{
          number: '1.0.0',
          created: null,
          game_versions: [],
          loaders: [],
          title: 'X',
          slug: 'x',
          type: 'mod',
        }]
      : []))

    expect(await profileFeed('u1', [], true)).toEqual([])
  })

  it('tnie do dwunastu wpisow', async () => {
    g.q = vi.fn()

    const days = Array.from({ length: 30 }, (_, i) =>
      day(`2026-09-${String(i + 1).padStart(2, '0')}`, 60))

    expect(await profileFeed('u1', days, false)).toHaveLength(12)
  })
})
