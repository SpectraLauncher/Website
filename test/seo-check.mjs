// node --experimental-strip-types test/seo-check.mjs
//
// Sprawdza gotowa strone, a nie zrodla: tytul, opis, canonical, hreflang, dane
// strukturalne, noindex tam gdzie ma byc, obrazek OG, sitemape, robots i llms.txt.
// Wymaga uruchomionego serwera. W trybie dev nuxt-robots blokuje indeksowanie,
// wiec kazde zadanie idzie z ?mockProductionEnv.
import assert from 'node:assert/strict'
import { TOOLS } from '../app/utils/tools.ts'

const BASE = (process.env.SEO_BASE || 'http://[::1]:3000').replace(/\/$/, '')
const PROD = 'mockProductionEnv'

const PRIVATE = ['/admin', '/account', '/login', '/reset-password', '/secret', '/launcher/auth', '/s/']

const get = async (path) => {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}${PROD}`
  const res = await fetch(url, { headers: { accept: 'text/html' } })
  return { status: res.status, type: res.headers.get('content-type') ?? '', body: await res.text() }
}

const between = (html, re) => (html.match(re) ?? [])[1] ?? ''
const title = html => between(html, /<title[^>]*>([^<]*)<\/title>/i)
const description = html => between(html, /<meta[^>]+name="description"[^>]+content="([^"]*)"/i)
const robots = html => between(html, /<meta[^>]+name="robots"[^>]+content="([^"]*)"/i)
const canonical = html => between(html, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i)
const ogImage = html => between(html, /<meta[^>]+property="og:image"[^>]+content="([^"]*)"/i)

const types = (html) => {
  const blocks = []
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html))) blocks.push(JSON.parse(m[1]))
  return blocks.flatMap(b => (b['@graph'] ?? [b]).flatMap(n => [n['@type']].flat()))
}

let checked = 0
const seenTitles = new Map()

async function page(path, expect = {}) {
  const { status, body } = await get(path)
  assert.equal(status, expect.status ?? 200, `${path}: kod ${status}`)

  const t = title(body)
  assert.ok(t.length > 5 && t.length < 90, `${path}: tytul ma ${t.length} znakow — "${t}"`)
  assert.ok(!/Spectra\s*[|—-]\s*Spectra/.test(t), `${path}: nazwa serwisu podwojona — "${t}"`)

  if (expect.unique !== false) {
    assert.ok(!seenTitles.has(t), `${path}: tytul powtarza sie z ${seenTitles.get(t)}`)
    seenTitles.set(t, path)
  }

  assert.ok(description(body).length > 40, `${path}: opis za krotki`)
  assert.ok(canonical(body).startsWith('http'), `${path}: brak canonical`)
  assert.match(body, /hreflang="pl-PL"/, `${path}: brak hreflang pl`)
  assert.match(body, /hreflang="x-default"/, `${path}: brak x-default`)

  if (expect.noindex) assert.match(robots(body), /noindex/, `${path}: mial byc noindex`)
  else assert.doesNotMatch(robots(body), /noindex/, `${path}: nie moze byc noindex`)

  for (const wanted of expect.schema ?? []) {
    assert.ok(types(body).includes(wanted), `${path}: brak schematu ${wanted}`)
  }

  if (expect.og !== false) {
    const image = ogImage(body)
    assert.ok(image, `${path}: brak og:image`)
    const res = await fetch(image.replace(/^https?:\/\/[^/]+/, BASE))
    assert.equal(res.status, 200, `${path}: og:image zwrocil ${res.status}`)
    assert.match(res.headers.get('content-type') ?? '', /image\//, `${path}: og:image nie jest obrazkiem`)
  }

  checked++
}

await page('/', { schema: ['WebSite', 'Organization'] })
await page('/tools', { schema: ['CollectionPage', 'ItemList', 'BreadcrumbList'] })
await page('/tools/gradient', { schema: ['WebApplication', 'BreadcrumbList', 'HowTo', 'FAQPage', 'Question'] })
await page('/pl/tools/gradient', { schema: ['WebApplication', 'FAQPage'] })
await page('/launcher', { schema: ['SoftwareApplication', 'BreadcrumbList'] })
await page('/badges', { schema: ['CollectionPage', 'ItemList'] })
await page('/privacy', {})
await page('/login', { noindex: true, unique: false, og: false })
await page('/account', { noindex: true, unique: false, og: false })
console.log(`strony: ${checked} ok (tytul, opis, canonical, hreflang, schema, og:image)`)

const robotsTxt = (await get('/robots.txt')).body
assert.match(robotsTxt, /^Sitemap: https?:\/\/\S+sitemap\S*\.xml$/m, 'robots: brak sitemapy')
for (const path of PRIVATE) {
  assert.ok(robotsTxt.includes(`Disallow: ${path}`), `robots: brak ${path}`)
}
console.log('robots.txt ok')

const index = (await get('/sitemap_index.xml')).body
for (const locale of ['en-US', 'pl-PL']) {
  assert.ok(index.includes(`${locale}.xml`), `sitemap: brak mapy ${locale}`)
}

const sitemap = (await get('/__sitemap__/en-US.xml')).body
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
for (const tool of TOOLS.filter(t => t.page)) {
  assert.ok(locs.some(loc => loc.endsWith(`/tools/${tool.id}`)), `sitemap: brak ${tool.id}`)
}
for (const path of PRIVATE) {
  assert.ok(!locs.some(loc => loc.includes(path)), `sitemap: prywatna sciezka ${path}`)
}
assert.equal(new Set(locs).size, locs.length, 'sitemap: powtorzone adresy')
assert.match(sitemap, /hreflang="pl-PL"/, 'sitemap: brak alternatyw jezykowych')
console.log(`sitemap ok (${locs.length} adresow w mapie en)`)

const llms = (await get('/llms.txt')).body
assert.match(llms, /^# /m, 'llms.txt: brak naglowka')
assert.ok(llms.includes('llms-full.txt'), 'llms.txt: brak odnosnika do pelnej tresci')
console.log('llms.txt ok')
