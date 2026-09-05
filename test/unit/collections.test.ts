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

  // Niepubliczna otwiera sie z linku, ale nie trafia na profil — te same dwa
  // pytania co przy projekcie.
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

  // Dwa szybkie klikniecia gwiazdki nie moga zrobic dwoch polek, bo projekt
  // wpadlby do jednej z nich i znikal z widoku przy nastepnym odczycie.
  it('baza dopuszcza tylko jedna na konto', () => {
    expect(schema).toContain('uniq_collection_favourites')
    expect(schema).toContain(`ON collection (user_id) WHERE kind = 'favourites'`)
  })

  it('tworzenie znosi wyscig zamiast rzucac', () => {
    expect(source).toContain('ON CONFLICT (user_id)')
    expect(source).toContain('DO NOTHING')
  })

  // Polka jest miejscem, na ktore trafia gwiazdka. Skasowanie jej zostawiloby
  // przycisk bez celu.
  it('nie da sie jej skasowac', () => {
    expect(source).toContain(`DELETE FROM collection WHERE id = $1 AND kind <> 'favourites'`)
  })

  it('nie da sie jej przemianowac, bo nazwa idzie z tlumaczenia', () => {
    expect(source).toContain(`current.kind === 'favourites' || input.title === undefined`)
  })
})

describe('ulubione a obserwowanie', () => {
  // Dwa rozne pytania: "chce wiedziec o aktualizacjach" i "chce to miec pod
  // reka". Gdyby gwiazdka ruszala licznik obserwujacych, publiczna popularnosc
  // projektu mieszalaby sie z prywatna polka czytelnika.
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
