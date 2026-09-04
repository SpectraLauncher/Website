import { describe, expect, it } from 'vitest'

import { ID_LENGTH, isPublicId, looksLikeId, newId } from '../../server/utils/ids'
import { slugProblem } from '../../server/utils/catalog-slug'

describe('newId', () => {
  it('ma stala dlugosc i tylko znaki base62', () => {
    for (let i = 0; i < 200; i++) {
      const id = newId()
      expect(id).toHaveLength(ID_LENGTH)
      expect(id).toMatch(/^[0-9A-Za-z]+$/)
    }
  })

  it('nie powtarza sie', () => {
    const seen = new Set(Array.from({ length: 5000 }, () => newId()))
    expect(seen.size).toBe(5000)
  })

  // Odrzucanie probek: 256 nie dzieli sie przez 62, wiec samo modulo zrobiloby
  // pierwsze znaki alfabetu czestszymi. Przy 62 koszykach i 62 tysiacach losowan
  // srednia to 1000; rozstrzal ponizej polowy lapie jawne przekrzywienie, nie
  // szum.
  it('rozklada znaki rownomiernie', () => {
    const counts = new Map<string, number>()
    for (let i = 0; i < 62_000; i++) {
      for (const ch of newId()) counts.set(ch, (counts.get(ch) ?? 0) + 1)
    }

    const values = [...counts.values()]
    expect(counts.size).toBe(62)
    expect(Math.min(...values)).toBeGreaterThan(ID_LENGTH * 1000 * 0.5)
    expect(Math.max(...values)).toBeLessThan(ID_LENGTH * 1000 * 1.5)
  })
})

describe('isPublicId', () => {
  it('przepuszcza wlasne identyfikatory', () => {
    expect(isPublicId(newId())).toBe(true)
  })

  it('odrzuca zla dlugosc, znaki i typy', () => {
    for (const value of ['', 'abc', 'a'.repeat(ID_LENGTH + 1), 'abcd-efg', 'ABCDEF!H', 42, null]) {
      expect(isPublicId(value), JSON.stringify(value)).toBe(false)
    }
  })
})

describe('slug kontra identyfikator', () => {
  // Slug jest zawsze z malych liter, wiec identyfikator z wielka litera nie moze
  // byc z nim pomylony. Zostaje okolo jeden na sto identyfikatorow, ktore wychodza
  // same male — i wlasnie dlatego slug o tym ksztalcie jest odrzucany.
  it('slug wygladajacy jak identyfikator jest odrzucany', () => {
    expect(looksLikeId('abcd1234')).toBe(true)
    expect(slugProblem('abcd1234')).toBe('id-shaped')
  })

  it('zwykle slugi przechodza', () => {
    for (const slug of ['sodium', 'fabric-api', 'better-leaves', 'jade', 'abcd123']) {
      expect(looksLikeId(slug), slug).toBe(false)
      expect(slugProblem(slug), slug).toBeNull()
    }
  })

  it('mysnik ratuje slug o dlugosci identyfikatora', () => {
    expect(looksLikeId('abc-1234')).toBe(false)
    expect(slugProblem('abc-1234')).toBeNull()
  })
})
