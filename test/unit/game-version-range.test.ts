import { describe, expect, it } from 'vitest'

import { gameVersionRange } from '../../shared/utils/game-version-groups'

describe('zakres wersji gry na karcie', () => {
  it('pusta lista nie daje nic', () => {
    expect(gameVersionRange([])).toBe('')
  })

  it('jedna wersja zostaje soba', () => {
    expect(gameVersionRange(['1.21.1'])).toBe('1.21.1')
  })

  it('rozpina zakres miedzy najstarsza a najnowsza', () => {
    expect(gameVersionRange(['1.21.4', '1.20.1', '1.21.1'])).toBe('1.20.1 – 1.21.4')
  })

  it('porownuje liczbowo, nie leksykalnie', () => {
    expect(gameVersionRange(['1.9', '1.10'])).toBe('1.9 – 1.10')
    expect(gameVersionRange(['1.20', '1.20.1'])).toBe('1.20 – 1.20.1')
  })

  it('snapshoty sa liczone, bo nie maja porzadku', () => {
    expect(gameVersionRange(['1.20.1', '1.21.4', '24w14a'])).toBe('1.20.1 – 1.21.4 +1')
    expect(gameVersionRange(['1.21-pre1', '24w14a'])).toBe('+2')
  })

  it('same duplikaty nie robia zakresu z niczego', () => {
    expect(gameVersionRange(['1.21.1', '1.21.1'])).toBe('1.21.1 – 1.21.1')
  })
})
