import { describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/db', () => ({ usePool: vi.fn(), exec: vi.fn(), one: vi.fn(), q: vi.fn() }))

const { mailTemplate } = await import('../../server/utils/auth')

const base = {
  preheader: 'p',
  eyebrow: 'e',
  title: 't',
  body: 'b',
  ctaUrl: 'https://usespectra.app/x',
  ctaLabel: 'go',
  footnote: 'f',
}

// Every mail carries text a person typed — an account name, an organization
// name, a project title — and HTML is built out of it.
describe('mailTemplate escapuje tekst', () => {
  it('znaczniki nie staja sie znacznikami', () => {
    const html = mailTemplate({ ...base, title: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('cudzyslow nie wychodzi z atrybutu', () => {
    const html = mailTemplate({ ...base, body: 'a" onload="alert(1)' })
    expect(html).toContain('&quot;')
    expect(html).not.toContain('a" onload="alert(1)')
  })

  it.each(['preheader', 'eyebrow', 'title', 'body', 'ctaLabel', 'footnote'] as const)(
    'pole %s jest escapowane', (field) => {
      const html = mailTemplate({ ...base, [field]: '<b>x</b>' })
      expect(html).not.toContain('<b>x</b>')
    })

  it('adres zostaje adresem', () => {
    const html = mailTemplate(base)
    expect(html).toContain('https://usespectra.app/x')
  })

  it('cudzyslow w adresie nie zamyka atrybutu href', () => {
    const html = mailTemplate({ ...base, ctaUrl: 'https://x.test/a"onmouseover="alert(1)' })
    expect(html).not.toContain('"onmouseover="')
  })
})
