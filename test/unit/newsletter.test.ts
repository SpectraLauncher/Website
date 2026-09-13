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

    // Recursive: reactions live under [slug]/, and a handler that skipped the
    // status filter would have been invisible to a flat listing.
    const every = (path: string): string[] => readdirSync(path, { withFileTypes: true })
      .flatMap(entry => (entry.isDirectory()
        ? every(join(path, entry.name))
        : [join(path, entry.name)]))

    for (const file of every(dir)) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/\bpostById\(|\bpostsOfKind\(/)
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

// Double opt-in: anybody can type somebody else's address into a form, so the
// click in the mailbox is what decides, not the submit.
describe('potwierdzenie zapisu', () => {
  const source = readFileSync('server/utils/newsletter.ts', 'utf8')

  it('adres startuje niepotwierdzony', () => {
    expect(source).toMatch(/VALUES \(\$1, \$2, \$3, \$4, NULL, \$5\)/)
  })

  it('wysylka idzie wylacznie do potwierdzonych', () => {
    expect(source).toMatch(/const list = await confirmedSubscribers\(\)/)
    expect(source).toMatch(/WHERE confirmed IS NOT NULL/)
  })

  it('potwierdzenie dziala raz', () => {
    // claimed in the statement that reads it, so a replayed link changes nothing
    expect(source).toMatch(/SET confirmed = \$2[\s\S]*?WHERE token = \$1 AND confirmed IS NULL/)
  })

  it('mail potwierdzajacy tez niesie wypis', () => {
    expect(source).toMatch(/sendConfirmation/)
    expect(source).toMatch(/news\/unsubscribe\?token=/)
  })

  it('formularz nie wysyla maila komus, kto juz potwierdzil', () => {
    expect(readFileSync('server/api/news/subscribe.post.ts', 'utf8'))
      .toMatch(/if \(!row\.confirmed\)/)
  })
})
