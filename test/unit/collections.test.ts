import { describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'

import {
  COLLECTION_KINDS,
  COLLECTION_VISIBILITIES,
  collectionVisible,
  isCollectionVisibility,
} from '../../server/utils/collections'

const row = (over: Record<string, unknown> = {}) => ({
  id: 'k1',
  user_id: 'u1',
  title: 'Ulubione',
  summary: '',
  icon: null,
  visibility: 'private' as const,
  created: 1,
  updated: 1,
  ...over,
}) as any

describe('widocznosc kolekcji', () => {
  it('wlasciciel widzi kazda swoja', () => {
    for (const visibility of COLLECTION_VISIBILITIES) {
      expect(collectionVisible(row({ visibility }), { id: 'u1' }), visibility).toBe(true)
    }
  })

  it('prywatna jest niewidoczna dla obcego i dla anonima', () => {
    expect(collectionVisible(row(), { id: 'u2' })).toBe(false)
    expect(collectionVisible(row(), null)).toBe(false)
  })

  // Unlisted opens from a link but stays off the profile: the same two
  // questions a project answers.
  it('niepubliczna i publiczna otwieraja sie z linku', () => {
    for (const visibility of ['unlisted', 'listed'] as const) {
      expect(collectionVisible(row({ visibility }), null), visibility).toBe(true)
    }
  })
})

describe('isCollectionVisibility', () => {
  it('przyjmuje tylko znane wartosci', () => {
    for (const value of COLLECTION_VISIBILITIES) expect(isCollectionVisibility(value)).toBe(true)
    for (const bad of ['public', '', null, 42, undefined]) {
      expect(isCollectionVisibility(bad), String(bad)).toBe(false)
    }
  })
})

describe('polka ulubionych', () => {
  const source = readFileSync('server/utils/collections.ts', 'utf8')
  const schema = readFileSync('server/utils/schema-catalog.ts', 'utf8')

  it('jest osobnym rodzajem kolekcji', () => {
    expect([...COLLECTION_KINDS]).toEqual(['favourites', 'custom'])
  })

  // Two quick stars must not make two shelves: the project would land in one
  // and vanish from view on the next read.
  it('baza dopuszcza tylko jedna na konto', () => {
    expect(schema).toContain('uniq_collection_favourites')
    expect(schema).toContain(`ON collection (user_id) WHERE kind = 'favourites'`)
  })

  it('tworzenie znosi wyscig zamiast rzucac', () => {
    expect(source).toContain('ON CONFLICT (user_id)')
    expect(source).toContain('DO NOTHING')
  })

  // The shelf is where the star puts things; deleting it leaves the button
  // pointing at nothing.
  it('nie da sie jej skasowac', () => {
    expect(source).toContain(`DELETE FROM collection WHERE id = $1 AND kind <> 'favourites'`)
  })

  it('nie da sie jej przemianowac, bo nazwa idzie z tlumaczenia', () => {
    expect(source).toContain(`current.kind === 'favourites' || input.title === undefined`)
  })
})

describe('ulubione a obserwowanie', () => {
  // Two different questions: wanting to hear about changes, and wanting the
  // thing to hand. If the star moved the follower count, a project's public
  // popularity would mix with a reader's private shelf.
  it('gwiazdka nie dotyka tabeli obserwowania', () => {
    for (const route of ['favourite.post.ts', 'favourite.delete.ts']) {
      const source = readFileSync(`server/api/catalog/project/[slug]/${route}`, 'utf8')
      expect(source, route).not.toContain('followProject')
      expect(source, route).not.toContain('project_follow')
      expect(source, route).toContain('favouritesFor(user.id)')
    }
  })

  it('obie trasy sprawdzaja widocznosc projektu', () => {
    for (const route of ['favourite.post.ts', 'favourite.delete.ts']) {
      const source = readFileSync(`server/api/catalog/project/[slug]/${route}`, 'utf8')
      expect(source, route).toContain('requireCatalogRead(event)')
      expect(source, route).toContain('visibleProject(project, user)')
    }
  })
})
