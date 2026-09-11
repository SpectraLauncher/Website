import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/db', () => ({ usePool: vi.fn(), exec: vi.fn(), one: vi.fn(), q: vi.fn() }))

const { isEmail, renderIssue } = await import('../../server/utils/newsletter')

const issue = (over: Record<string, unknown> = {}) => ({
  id: 'i1',
  kind: 'newsletter',
  slug: null,
  title: 'Hello',
  summary: '',
  body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'body' }] }] },
  cover: null,
  status: 'published',
  author_id: null,
  created: 0,
  updated: 0,
  published: null,
  sent: null,
  recipients: 0,
  ...over,
} as never)

describe('adresy', () => {
  it('przyjmuje to, co wyglada jak adres', () => {
    for (const value of ['a@b.pl', 'first.last+tag@sub.example.co.uk']) {
      expect(isEmail(value), value).toBe(true)
    }
  })

  it('odrzuca to, co adresem nie jest', () => {
    for (const value of ['', 'a@b', 'a b@c.pl', 'a@@b.pl', null, undefined, 42, `${'x'.repeat(320)}@b.pl`]) {
      expect(isEmail(value), String(value)).toBe(false)
    }
  })
})

describe('wydanie newslettera jako mail', () => {
  it('kazdy dostaje link z wlasnym tokenem', () => {
    const one = renderIssue(issue(), { origin: 'https://usespectra.app', token: 'aaa' })
    const two = renderIssue(issue(), { origin: 'https://usespectra.app', token: 'bbb' })

    expect(one.html).toContain('/news/unsubscribe?token=aaa')
    expect(two.html).toContain('/news/unsubscribe?token=bbb')
    expect(one.html).not.toContain('bbb')
  })

  it('token trafia do adresu zakodowany', () => {
    const mail = renderIssue(issue(), { origin: 'https://usespectra.app', token: 'a b&c' })
    expect(mail.html).toContain('token=a%20b%26c')
  })

  it('tytul nie staje sie znacznikiem', () => {
    const mail = renderIssue(issue({ title: '<img src=x onerror=alert(1)>' }), {
      origin: 'https://usespectra.app',
      token: 't',
    })

    expect(mail.html).not.toContain('<img')
    expect(mail.html).toContain('&lt;img')
    expect(mail.subject).toBe('<img src=x onerror=alert(1)>')
  })

  it('pusty tytul nie zostawia maila bez tematu', () => {
    expect(renderIssue(issue({ title: '' }), { origin: 'https://x', token: 't' }).subject).toBe('Spectra')
  })
})

// The blog is the one public part of this, and a draft is not it. Both public
// handlers must go through the helpers that carry the status filter.
describe('publiczne trasy newsa', () => {
  const dir = 'server/api/news'
  const source = (file: string) => readFileSync(join(dir, file), 'utf8')

  it('lista i wpis siegaja tylko po opublikowane', () => {
    expect(source('index.get.ts')).toMatch(/publishedArticles\(/)
    expect(source('[slug].get.ts')).toMatch(/publishedArticle\(/)

    for (const file of readdirSync(dir)) {
      expect(source(file), file).not.toMatch(/\bpostById\(|\bpostsOfKind\(/)
    }
  })

  it('kazda trasa admina od wpisow ma brame', () => {
    const walk = (path: string): string[] => readdirSync(path, { withFileTypes: true })
      .flatMap(entry => (entry.isDirectory()
        ? walk(join(path, entry.name))
        : [join(path, entry.name)]))

    const routes = [...walk('server/api/admin/posts'), ...walk('server/api/admin/newsletter')]
    expect(routes.length).toBeGreaterThan(5)

    for (const route of routes) {
      expect(readFileSync(route, 'utf8'), route).toMatch(/requireAdmin\(event\)/)
    }
  })
})
