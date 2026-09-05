import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useProjectCollections } from '../../app/composables/useProjectCollections'

const project = computed(() => ({ id: 'p1', slug: 'jade' }))

const shelf = { id: 'fav', kind: 'favourites' as const, title: 'Favourites', projects: 0 }
const custom = { id: 'c1', kind: 'custom' as const, title: 'Serwer', projects: 2 }

let calls: Array<{ url: string, method?: string }>

beforeEach(() => {
  calls = []
  vi.stubGlobal('$fetch', vi.fn(async (url: string, opts: any = {}) => {
    calls.push({ url, method: opts.method })
    if (url === '/api/catalog/collections' && opts.method === 'POST') {
      return { collection: { id: 'new', kind: 'custom', title: opts.body.title, projects: 0 } }
    }
    if (url === '/api/catalog/collections') return { collections: [shelf, custom], holding: [] }
    return {}
  }))
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
})

describe('gwiazdka i pozycja w menu to jeden wiersz', () => {
  it('klikniecie gwiazdki zaznacza polke w menu', async () => {
    const c = useProjectCollections(project)
    await c.load()

    expect(c.favourited.value).toBe(false)
    await c.toggleFavourite()

    expect(c.favourited.value).toBe(true)
    expect(c.holding.value).toContain('fav')
  })

  it('odznaczenie polki w menu gasi gwiazdke', async () => {
    const c = useProjectCollections(project)
    await c.load()
    await c.toggleFavourite()

    await c.setMembership('fav', false)

    expect(c.favourited.value).toBe(false)
    expect(c.holding.value).not.toContain('fav')
  })

  // Zwykla kolekcja nie ma nic wspolnego z gwiazdka.
  it('zwykla kolekcja nie rusza gwiazdki', async () => {
    const c = useProjectCollections(project)
    await c.load()

    await c.setMembership('c1', true)

    expect(c.holding.value).toContain('c1')
    expect(c.favourited.value).toBe(false)
  })

  it('gwiazdka klikana dwa razy nie dubluje wpisu', async () => {
    const c = useProjectCollections(project)
    await c.load()

    await c.toggleFavourite()
    await c.setMembership('fav', true)

    expect(c.holding.value.filter(id => id === 'fav')).toHaveLength(1)
  })
})

describe('tworzenie kolekcji z menu', () => {
  it('zaklada ja i od razu wrzuca projekt', async () => {
    const c = useProjectCollections(project)
    await c.load()

    expect(await c.createAndAdd('Nowa')).toBe(true)

    expect(c.collections.value.map(x => x.id)).toContain('new')
    expect(c.holding.value).toContain('new')
    expect(calls.some(x => x.url === '/api/catalog/collections/new/projects' && x.method === 'POST'))
      .toBe(true)
  })

  it('pusta nazwa nie wysyla niczego', async () => {
    const c = useProjectCollections(project)
    const before = calls.length

    expect(await c.createAndAdd('   ')).toBe(false)
    expect(calls).toHaveLength(before)
  })
})
