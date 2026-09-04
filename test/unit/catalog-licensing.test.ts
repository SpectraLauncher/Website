import { describe, expect, it } from 'vitest'

import { AUTHORSHIP_TERMS, allowsCommercialUse, saleNote } from '../../server/utils/catalog-licensing'
import { LICENSES } from '../../server/utils/catalog-types'

describe('sprzedaz a licencja', () => {
  it('licencja niekomercyjna jest konfliktem, ale nie blokada', () => {
    const note = saleNote('CC-BY-NC-SA-4.0')
    expect(note.level).toBe('conflict')
    expect(note.message).toContain('forbids commercial use')
    expect(allowsCommercialUse('CC-BY-NC-SA-4.0')).toBe(false)
  })

  // GPL sprzedazy nie zabrania. Zabrania czegos innego: zamkniecia zrodel przed
  // kupujacym — i to jest rzecz, ktora sprzedawca musi zobaczyc przed cena.
  it('copyleft pozwala sprzedawac, ale niesie zobowiazanie', () => {
    for (const license of ['GPL-3.0-only', 'LGPL-3.0-only', 'MPL-2.0', 'CC-BY-SA-4.0']) {
      const note = saleNote(license)
      expect(note.level, license).toBe('obligation')
      expect(allowsCommercialUse(license), license).toBe(true)
    }
  })

  it('licencje permisywne nie generuja noty', () => {
    for (const license of ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'CC0-1.0', 'ARR']) {
      expect(saleNote(license).level, license).toBe('none')
    }
  })

  it('brak licencji i "other" zawsze cos mowia', () => {
    expect(saleNote(null).level).toBe('obligation')
    expect(saleNote('other').level).toBe('obligation')
  })

  it('kazda licencja z listy jest rozstrzygnieta', () => {
    for (const license of LICENSES) {
      expect(['none', 'obligation', 'conflict'], license).toContain(saleNote(license).level)
    }
  })
})

describe('oswiadczenie autorstwa', () => {
  // Wersjonowane, zeby pozniejsza zmiana tekstu nie przepisala po cichu tego,
  // co widzieli wczesniejsi sprzedawcy.
  it('ma identyfikator wersji, a nie sama tresc', () => {
    expect(AUTHORSHIP_TERMS).toMatch(/^authorship-v\d+$/)
  })
})
