import { describe, expect, it } from 'vitest'

import { AUTHORSHIP_TERMS } from '../../server/utils/catalog-licensing'

describe('oswiadczenie autorstwa', () => {
  // Wersjonowane, zeby pozniejsza zmiana tekstu nie przepisala po cichu tego,
  // co widzieli wczesniejsi sprzedawcy.
  it('ma identyfikator wersji, a nie sama tresc', () => {
    expect(AUTHORSHIP_TERMS).toMatch(/^authorship-v\d+$/)
  })
})
