import { describe, expect, it } from 'vitest'

import {
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
