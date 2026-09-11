import { describe, expect, it } from 'vitest'

import { postExcerpt, postImageUrls, renderPostDoc } from '../../shared/utils/post-doc'

const doc = (...content: unknown[]) => ({ type: 'doc', content })
const text = (value: string, marks?: unknown[]) => ({ type: 'text', text: value, marks })
const para = (...content: unknown[]) => ({ type: 'paragraph', content })

describe('renderowanie dokumentu wpisu', () => {
  it('nic sensownego na wejsciu to pusty wynik', () => {
    for (const value of [null, undefined, '', 42, []]) {
      expect(renderPostDoc(value), String(value)).toBe('')
    }
  })

  it('akapit z tekstem', () => {
    expect(renderPostDoc(doc(para(text('Cześć'))))).toBe('<p>Cześć</p>')
  })

  it('pusty akapit nie zostawia pustego znacznika', () => {
    expect(renderPostDoc(doc(para()))).toBe('')
  })

  // The whole reason this renderer exists rather than storing the editor's HTML.
  it('tekst jest escapowany', () => {
    expect(renderPostDoc(doc(para(text('<script>alert(1)</script>')))))
      .toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
  })

  it('nieznany wezel traci ksztalt, nie slowa', () => {
    expect(renderPostDoc(doc({ type: 'iframe', content: [text('tresc')] }))).toBe('tresc')
  })

  it('nieznany znacznik nie zmienia tekstu', () => {
    expect(renderPostDoc(doc(para(text('x', [{ type: 'blink' }]))))).toBe('<p>x</p>')
  })

  it('sklada znaczniki', () => {
    expect(renderPostDoc(doc(para(text('x', [{ type: 'bold' }, { type: 'italic' }])))))
      .toBe('<p><em><strong>x</strong></em></p>')
  })

  describe('odsylacze', () => {
    it('http przechodzi i dostaje nofollow', () => {
      const html = renderPostDoc(doc(para(text('link', [
        { type: 'link', attrs: { href: 'https://example.com' } },
      ]))))

      expect(html).toContain('href="https://example.com/"')
      expect(html).toContain('rel="nofollow noopener noreferrer"')
    })

    it('javascript: nie przechodzi, tekst zostaje', () => {
      const html = renderPostDoc(doc(para(text('klik', [
        { type: 'link', attrs: { href: 'javascript:alert(1)' } },
      ]))))

      expect(html).toBe('<p>klik</p>')
    })
  })

  describe('obrazy', () => {
    it('sciezka wzgledna przechodzi', () => {
      expect(renderPostDoc(doc({ type: 'image', attrs: { src: '/uploads/a.webp', alt: 'a' } })))
        .toBe('<img src="/uploads/a.webp" alt="a" loading="lazy">')
    })

    it('obraz bez zrodla znika', () => {
      expect(renderPostDoc(doc({ type: 'image', attrs: { src: 'javascript:1' } }))).toBe('')
    })

    it('alt jest escapowany', () => {
      const html = renderPostDoc(doc({ type: 'image', attrs: { src: '/a.webp', alt: '"><b>' } }))
      expect(html).toContain('alt="&quot;&gt;&lt;b&gt;"')
    })
  })

  it('naglowek spoza zakresu ladnie sie zawija do h2', () => {
    expect(renderPostDoc(doc({ type: 'heading', attrs: { level: 1 }, content: [text('T')] })))
      .toBe('<h2>T</h2>')
    expect(renderPostDoc(doc({ type: 'heading', attrs: { level: 3 }, content: [text('T')] })))
      .toBe('<h3>T</h3>')
  })

  it('glebokie zagniezdzenie nie zawiesza renderu', () => {
    let deep: any = text('dno')
    for (let i = 0; i < 200; i++) deep = { type: 'blockquote', content: [deep] }

    expect(() => renderPostDoc(doc(deep))).not.toThrow()
  })
})

describe('zajawka', () => {
  it('sklada tekst z wezlow', () => {
    expect(postExcerpt(doc(para(text('Ala')), para(text('ma kota'))))).toBe('Ala ma kota')
  })

  it('tnie i dokleja wielokropek', () => {
    const long = postExcerpt(doc(para(text('a'.repeat(400)))), 20)
    expect(long).toHaveLength(20)
    expect(long.endsWith('…')).toBe(true)
  })

  it('pusty dokument daje pusty tekst', () => {
    expect(postExcerpt(null)).toBe('')
  })
})

describe('obrazy w dokumencie', () => {
  it('zbiera adresy bez powtorzen', () => {
    const urls = postImageUrls(doc(
      { type: 'image', attrs: { src: '/a.webp' } },
      { type: 'image', attrs: { src: '/a.webp' } },
      para({ type: 'image', attrs: { src: '/b.webp' } }),
    ))

    expect(urls).toEqual(['/a.webp', '/b.webp'])
  })

  it('pomija adresy, ktorych nie wpuscilibysmy do strony', () => {
    expect(postImageUrls(doc({ type: 'image', attrs: { src: 'javascript:1' } }))).toEqual([])
  })
})
