import { describe, expect, it } from 'vitest'

import { fixture, hasFixtures } from '../fixtures'

import { scanArchive, worstSeverity } from '../../server/utils/file-scan'

const scan = (name: string) => scanArchive(fixture(name))

const codes = (name: string) => scan(name).findings.map(f => f.code)

// Published builds by other people, so they are not in the repository; see
// test/fixtures/README.md. This is the half of the suite a fresh clone cannot
// run, and it is the half that matters most: a scanner that flags clean mods is
// worse than no scanner, because a moderator stops believing it within a week.
const CLEAN = [
  'Jade-1.20.1-Forge-11.13.3.jar',
  'Jade-1.21.1-NeoForge-15.10.6.jar',
  'Jade-mc26.1-Fabric-26.1.9.jar',
  'veinminer-paper-2.12.1.jar',
  'worldedit-bukkit-7.4.5.jar',
  'TAB v6.1.2.jar',
  'Better-Leaves-9.5.zip',
  'ComplementaryReimagined_r5.9.zip',
]

describe('nie krzyczy na porzadne pliki', () => {
  it('wygenerowany mod przechodzi jako czysty', () => {
    const result = scan('sample-fabric-mod.jar')
    expect(result.verdict, JSON.stringify(result.findings)).toBe('clean')
  })

  describe.skipIf(!hasFixtures(...CLEAN))('prawdziwe buildy', () => {
    it.each(CLEAN)('%s przechodzi jako czysty', (name) => {
      const result = scan(name)
      expect(result.verdict, JSON.stringify(result.findings)).toBe('clean')
    })

    it('naprawde czyta zawartosc, a nie tylko liste nazw', () => {
      expect(scan('Jade-1.20.1-Forge-11.13.3.jar').scanned).toBeGreaterThan(0)
    })
  })
})

describe('lapie to, po co powstal', () => {
  it('plik wykonywalny w jarze', () => {
    expect(codes('scan-executable.jar')).toContain('executable_entry')
    expect(scan('scan-executable.jar').verdict).toBe('flagged')
  })

  // Renaming is the cheapest trick, so the name alone is not enough.
  it('plik wykonywalny podszywajacy sie pod obrazek', () => {
    expect(codes('scan-disguised.jar')).toContain('disguised_executable')
  })

  it('adres hostingu dowolnych bajtow w kodzie', () => {
    const result = scan('scan-beacon.jar')
    expect(result.findings.map(f => f.code)).toContain('suspicious_host')
    expect(result.findings.find(f => f.code === 'suspicious_host')!.detail)
      .toContain('pastebin.com')
  })

  it('zip bomba nie przechodzi jako czysta', () => {
    expect(scan('zip-bomb.zip').verdict).not.toBe('clean')
  })
})

describe('werdykt', () => {
  it('nieczytelne archiwum nie jest ani czyste, ani oskarzone', () => {
    const result = scanArchive(Buffer.from('to nie jest zip'))
    expect(result.verdict).toBe('unreadable')
    expect(result.findings[0]!.severity).toBe('medium')
  })

  it('najciezsze znalezisko wygrywa', () => {
    expect(worstSeverity([
      { code: 'a', severity: 'low', detail: '' },
      { code: 'b', severity: 'high', detail: '' },
      { code: 'c', severity: 'medium', detail: '' },
    ])).toBe('high')

    expect(worstSeverity([])).toBeNull()
  })

  // A hundred copies of one line buries the other findings.
  it('nie powtarza tego samego znaleziska', () => {
    const result = scan('scan-executable.jar')
    const keys = result.findings.map(f => `${f.code}:${f.detail}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
