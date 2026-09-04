import { describe, expect, it } from 'vitest'

import {
  compareReleases,
  expandRange,
  parseRelease,
  releaseIds,
} from '../../server/utils/game-versions'

// A fixed slice of Mojang's list. Fixed on purpose: range resolution has to be
// deterministic and testable without reaching the network.
const AVAILABLE = [
  '1.21.4', '1.21.3', '1.21.1', '1.21',
  '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.20',
  '1.19.4', '1.19.2', '1.19',
  '1.18.2', '1.16.5', '1.12.2',
]

describe('parseRelease', () => {
  it('czyta wydania, odrzuca migawki', () => {
    expect(parseRelease('1.20.1')).toEqual([1, 20, 1])
    expect(parseRelease('1.21')).toEqual([1, 21])
    expect(parseRelease('24w14a')).toBeNull()
    expect(parseRelease('1.21-pre1')).toBeNull()
    expect(parseRelease('1.20.1-rc1')).toBeNull()
  })
})

describe('compareReleases', () => {
  it('porownuje po czlonach, nie leksykalnie', () => {
    // Leksykalnie '1.9' > '1.10', co jest najczestszym bledem w tej domenie.
    expect(compareReleases('1.10', '1.9')).toBeGreaterThan(0)
    expect(compareReleases('1.20.1', '1.20')).toBeGreaterThan(0)
    expect(compareReleases('1.20', '1.20.0')).toBe(0)
    expect(compareReleases('1.19.4', '1.20')).toBeLessThan(0)
  })
})

describe('releaseIds', () => {
  it('odsiewa migawki i wydania alfa', () => {
    expect(releaseIds([
      { id: '1.21', type: 'release', released: 2 },
      { id: '24w14a', type: 'snapshot', released: 1 },
      { id: 'a1.0', type: 'old_alpha', released: 0 },
    ])).toEqual(['1.21'])
  })
})

describe('expandRange', () => {
  it('dokladna wersja', () => {
    expect(expandRange('1.20.1', AVAILABLE)).toEqual(['1.20.1'])
  })

  it('operatory w stylu fabrica', () => {
    expect(expandRange('>=1.21', AVAILABLE)).toEqual(['1.21.4', '1.21.3', '1.21.1', '1.21'])
    expect(expandRange('<1.19', AVAILABLE)).toEqual(['1.18.2', '1.16.5', '1.12.2'])
    expect(expandRange('>1.20.4', AVAILABLE)).toEqual(['1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6'])
  })

  it('tylda trzyma sie tej samej wersji pomocniczej', () => {
    expect(expandRange('~1.20.1', AVAILABLE)).toEqual(['1.20.6', '1.20.4', '1.20.2', '1.20.1'])
  })

  it('daszek pozwala na ruch w gore wersji pomocniczej', () => {
    expect(expandRange('^1.20.1', AVAILABLE))
      .toEqual(['1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1'])
  })

  it('gwiazdka i x', () => {
    expect(expandRange('1.20.x', AVAILABLE)).toEqual(['1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.20'])
    expect(expandRange('1.19.*', AVAILABLE)).toEqual(['1.19.4', '1.19.2', '1.19'])
  })

  it('koniunkcja przez spacje', () => {
    expect(expandRange('>=1.20 <1.21', AVAILABLE))
      .toEqual(['1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.20'])
  })

  it('alternatywa przez ||', () => {
    expect(expandRange('1.16.5 || 1.12.2', AVAILABLE)).toEqual(['1.16.5', '1.12.2'])
  })

  // Forge i NeoForge pisza zakresy w notacji Mavena, nie npm-a.
  it('zakresy mavena', () => {
    expect(expandRange('[1.20,1.21)', AVAILABLE))
      .toEqual(['1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.20'])
    expect(expandRange('[1.20.1]', AVAILABLE)).toEqual(['1.20.1'])
    expect(expandRange('[1.21,]', AVAILABLE)).toEqual(['1.21.4', '1.21.3', '1.21.1', '1.21'])
    expect(expandRange('(1.20.4,1.21]', AVAILABLE)).toEqual(['1.21', '1.20.6'])
  })

  // Zakres loadera z prawdziwego mods.toml Jade. Dotyczy Forge'a, nie gry, wiec
  // nie moze przypadkiem wyprodukowac wersji Minecrafta.
  it('zakres wersji loadera nie udaje wersji gry', () => {
    expect(expandRange('[46,)', AVAILABLE)).toEqual([])
    expect(expandRange('[21.0.143, )', AVAILABLE)).toEqual([])
  })

  it('zakres nie do sparsowania daje pusto, a nie zgadywanke', () => {
    expect(expandRange('cokolwiek', AVAILABLE)).toEqual([])
    expect(expandRange('>=abc', AVAILABLE)).toEqual([])
    expect(expandRange('', AVAILABLE)).toEqual([])
    expect(expandRange(null, AVAILABLE)).toEqual([])
    expect(expandRange(undefined, AVAILABLE)).toEqual([])
  })

  it('gwiazdka bierze wszystko, co jest wydaniem', () => {
    expect(expandRange('*', AVAILABLE)).toEqual(AVAILABLE)
  })

  it('migawki nigdy nie wychodza z zakresu', () => {
    expect(expandRange('>=1.20', [...AVAILABLE, '24w14a', '1.21-pre1']))
      .not.toContain('24w14a')
  })
})
