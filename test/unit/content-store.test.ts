import { describe, expect, it } from 'vitest'

import {
  MAX_CONTENT_BYTES,
  contentKey,
  contentType,
  hashContent,
  safeFilename,
  tooLarge,
} from '../../server/utils/content-store'

const EMPTY_SHA1 = 'da39a3ee5e6b4b0d3255bfef95601890afd80709'
const EMPTY_SHA512 = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce'
  + '47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e'

describe('hashContent', () => {
  it('liczy sha1 i sha512 zgodnie z wektorami referencyjnymi', () => {
    const empty = hashContent(new Uint8Array(0), 'pusty.jar')
    expect(empty.sha1).toBe(EMPTY_SHA1)
    expect(empty.sha512).toBe(EMPTY_SHA512)

    const abc = hashContent(new TextEncoder().encode('abc'), 'abc.jar')
    expect(abc.sha1).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
    expect(abc.size).toBe(3)
  })

  it('ta sama tresc daje ten sam klucz niezaleznie od wywolania', () => {
    const body = new TextEncoder().encode('sodium')
    expect(hashContent(body, 'a.jar').key).toBe(hashContent(body, 'a.jar').key)
  })

  it('rozna tresc daje rozny klucz przy tej samej nazwie', () => {
    const a = hashContent(new TextEncoder().encode('a'), 'mod.jar')
    const b = hashContent(new TextEncoder().encode('b'), 'mod.jar')
    expect(a.key).not.toBe(b.key)
  })
})

describe('contentKey', () => {
  it('niesie sha512 w sciezce, z dwuznakowym shardem', () => {
    const key = contentKey('abcdef0123456789', 'sodium.jar')
    expect(key).toBe('content/ab/abcdef0123456789/sodium.jar')
  })

  it('przepuszcza nazwe przez safeFilename', () => {
    expect(contentKey('ff00', '../../evil.jar')).toBe('content/ff/ff00/evil.jar')
  })
})

describe('safeFilename', () => {
  it('zdejmuje katalogi i sekwencje wyjscia', () => {
    expect(safeFilename('a/b/c.jar')).toBe('c.jar')
    expect(safeFilename('..\\..\\evil.jar')).toBe('evil.jar')
    expect(safeFilename('../../etc/passwd')).toBe('passwd')
  })

  it('usuwa znaki sterujace, ktore ukrywaja prawdziwe rozszerzenie', () => {
    expect(safeFilename('evil.jar\u0000.png')).toBe('evil.jar.png')
    expect(safeFilename('mod\u007F.jar')).toBe('mod.jar')
  })

  it('podmienia znaki niedozwolone w nazwach', () => {
    expect(safeFilename('a<b>c:d"e|f?g*h.jar')).toBe('a_b_c_d_e_f_g_h.jar')
  })

  it('nigdy nie zwraca pustej nazwy', () => {
    expect(safeFilename('')).toBe('file')
    expect(safeFilename('...')).toBe('file')
    expect(safeFilename('/')).toBe('file')
  })

  it('przycina dlugosc', () => {
    expect(safeFilename('x'.repeat(500))).toHaveLength(200)
  })
})

describe('contentType', () => {
  it('mapuje znane rozszerzenia', () => {
    expect(contentType('sodium.jar')).toBe('application/java-archive')
    expect(contentType('pack.mrpack')).toBe('application/zip')
    expect(contentType('zamek.litematic')).toBe('application/octet-stream')
  })

  it('nieznane rozszerzenie nie staje sie typem wykonywalnym w przegladarce', () => {
    expect(contentType('x.html')).toBe('application/octet-stream')
    expect(contentType('x.svg')).toBe('application/octet-stream')
    expect(contentType('bezrozszerzenia')).toBe('application/octet-stream')
  })
})

describe('tooLarge', () => {
  it('odrzuca zero, ujemne, NaN i przekroczony limit', () => {
    expect(tooLarge(0)).toBe(true)
    expect(tooLarge(-1)).toBe(true)
    expect(tooLarge(Number.NaN)).toBe(true)
    expect(tooLarge(MAX_CONTENT_BYTES + 1)).toBe(true)
  })

  it('przepuszcza rozmiar w limicie', () => {
    expect(tooLarge(1)).toBe(false)
    expect(tooLarge(MAX_CONTENT_BYTES)).toBe(false)
  })
})
