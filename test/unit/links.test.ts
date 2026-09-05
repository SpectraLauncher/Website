import { describe, expect, it } from 'vitest'

import { cleanLinks, LINK_ICONS, LINK_KINDS, safeUrl } from '../../shared/utils/links'

describe('safeUrl', () => {
  it('przepuszcza http i https', () => {
    expect(safeUrl('https://example.com/a')).toBe('https://example.com/a')
    expect(safeUrl('http://example.com')).toBe('http://example.com/')
  })

  // Adres trafia prosto do href na stronie projektu, a katalog ma docelowo
  // przyjmowac wgrania od obcych ludzi.
  it('odrzuca schematy, ktore wykonuja kod', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      '  javascript:alert(1)  ',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ]) {
      expect(safeUrl(bad), bad).toBeNull()
    }
  })

  it('odrzuca smieci i za dlugie', () => {
    expect(safeUrl('')).toBeNull()
    expect(safeUrl('not a url')).toBeNull()
    expect(safeUrl('https://localhost')).toBeNull()
    expect(safeUrl(42)).toBeNull()
    expect(safeUrl(`https://example.com/${'a'.repeat(600)}`)).toBeNull()
  })
})

describe('cleanLinks', () => {
  it('zostawia tylko znane klucze', () => {
    expect(cleanLinks({ source: 'https://github.com/a/b', wat: 'https://example.com' }))
      .toEqual({ source: 'https://github.com/a/b' })
  })

  it('gubi zly link, nie caly zapis', () => {
    expect(cleanLinks({ source: 'https://github.com/a/b', issues: 'javascript:alert(1)' }))
      .toEqual({ source: 'https://github.com/a/b' })
  })

  it('znosi wejscie, ktore nie jest mapa', () => {
    for (const bad of [null, undefined, 'x', 42, ['https://example.com']]) {
      expect(cleanLinks(bad)).toEqual({})
    }
  })
})

it('kazdy rodzaj linku ma ikone', () => {
  for (const kind of LINK_KINDS) expect(LINK_ICONS[kind], kind).toBeTruthy()
})
