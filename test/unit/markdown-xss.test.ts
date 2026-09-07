import { describe, expect, it } from 'vitest'

import { renderMarkdown, youtubeId } from '../../app/utils/markdown'

// Project descriptions, organization readmes and text from strangers go through
// this renderer straight into v-html. It is the only thing standing between them
// and code running on the page.
describe('renderMarkdown nie wpuszcza kodu', () => {
  it('surowy HTML jest escapowany, nie wykonywany', () => {
    const out = renderMarkdown('<script>alert(1)</script>')
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;script&gt;')
  })

  // The word "onerror" survives as text and that is fine: the angle bracket is
  // escaped, so it never becomes an attribute.
  it('atrybuty zdarzen nie staja sie atrybutami', () => {
    const out = renderMarkdown('<img src=x onerror=alert(1)>')
    expect(out).toContain('&lt;img')
    expect(out.toLowerCase()).not.toMatch(/<img[^>]*onerror/)
  })

  it('iframe i object nie przechodza', () => {
    for (const payload of ['<iframe src="//evil"></iframe>', '<object data="//evil"></object>']) {
      const out = renderMarkdown(payload)
      expect(out.toLowerCase(), payload).not.toContain('<iframe')
      expect(out.toLowerCase(), payload).not.toContain('<object')
    }
  })

  it('javascript: w linku nie zostaje adresem', () => {
    for (const payload of [
      '[klik](javascript:alert(1))',
      '[klik](JaVaScRiPt:alert(1))',
      '[klik](vbscript:msgbox(1))',
      '[klik](data:text/html,<script>alert(1)</script>)',
    ]) {
      const out = renderMarkdown(payload)
      expect(out.toLowerCase(), payload).not.toContain('href="javascript:')
      expect(out.toLowerCase(), payload).not.toContain('href="vbscript:')
      expect(out.toLowerCase(), payload).not.toContain('href="data:text/html')
    }
  })

  it('javascript: w obrazku nie zostaje zrodlem', () => {
    const out = renderMarkdown('![x](javascript:alert(1))')
    expect(out.toLowerCase()).not.toContain('src="javascript:')
  })

  it('zwykly link dostaje rel i target', () => {
    const out = renderMarkdown('[a](https://example.com)')
    expect(out).toContain('rel="nofollow ugc noopener noreferrer"')
    expect(out).toContain('target="_blank"')
  })

  it('autolinkowany adres tez dostaje rel', () => {
    expect(renderMarkdown('https://example.com')).toContain('nofollow ugc noopener noreferrer')
  })

  it('obrazek nie wysyla referrera', () => {
    const out = renderMarkdown('![a](https://example.com/a.png)')
    expect(out).toContain('referrerpolicy="no-referrer"')
    expect(out).toContain('loading="lazy"')
  })
})

// markdown-it decodes a punycode hostname back to Unicode for display, so a bare
// address renders as a lookalike while linking to the real one. The address is
// what a reader judges before clicking.
describe('a link reads as the place it goes', () => {
  const homograph = 'https://xn--pple-43d.com/'

  it('an autolinked address is shown as it will be visited', () => {
    const out = renderMarkdown(homograph)
    expect(out).toContain(`>${homograph}<`)
    expect(out).not.toContain('аpple.com')
  })

  it('the address itself is untouched', () => {
    expect(renderMarkdown(homograph)).toContain(`href="${homograph}"`)
  })

  it('an ordinary address still reads normally', () => {
    const out = renderMarkdown('https://example.com/a')
    expect(out).toContain('>https://example.com/a<')
  })
})

describe('osadzony film', () => {
  it('sam link w linijce staje sie odtwarzaczem', () => {
    const html = renderMarkdown('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(html).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(html).toContain('<iframe')
  })

  it('rozpoznaje skrocony adres i shorts', () => {
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30')).toBe('dQw4w9WgXcQ')
  })

  // The whole safety of this is that nothing from the source reaches an
  // attribute: only an eleven-character id gets through, and the URL is built
  // from it here.
  it('nie przepuszcza niczego, co nie jest identyfikatorem', () => {
    expect(youtubeId('https://youtube.com/watch?v=../../evil')).toBeNull()
    expect(youtubeId('https://youtube.com/watch?v="onload=alert(1)')).toBeNull()
    expect(youtubeId('https://evil.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(youtubeId('https://youtube.com/watch?v=short')).toBeNull()
  })

  it('link w srodku zdania zostaje linkiem', () => {
    const html = renderMarkdown('zobacz https://youtu.be/dQw4w9WgXcQ tutaj')
    expect(html).not.toContain('<iframe')
    expect(html).toContain('<a href')
  })

  it('wlasny iframe autora dalej jest escapowany', () => {
    expect(renderMarkdown('<iframe src="evil"></iframe>')).not.toContain('<iframe')
  })
})
