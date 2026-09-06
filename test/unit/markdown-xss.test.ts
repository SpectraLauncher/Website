import { describe, expect, it } from 'vitest'

import { renderMarkdown } from '../../app/utils/markdown'

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
