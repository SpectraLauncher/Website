import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(file, 'utf8')

const PROJECT = 'app/pages/[type]/[slug]/[...tab].vue'
const PROFILE = 'app/pages/u/[username].vue'
const TEMPLATE = 'app/components/OgImage/Entity.satori.vue'

// Satori draws the card on the server and fetches every image itself, so a
// relative src resolves against nothing and silently renders an empty column.
describe('karta do udostepniania', () => {
  it('projekt rysuje wlasna karte, nie podstawia surowej ikony', () => {
    const source = read(PROJECT)

    expect(source).toMatch(/defineOgImage\('Entity'/)
    expect(source).toMatch(/image: \(\) => project\.value\?\.icon/)
  })

  it('profil pokazuje render postaci', () => {
    const source = read(PROFILE)

    expect(source).toMatch(/defineOgImage\('Entity'/)
    expect(source).toMatch(/image: \(\) => renderUrl\.value/)
    expect(source).toMatch(/portrait: true/)
  })

  it('nic nie ustawia og:image obok wygenerowanej karty', () => {
    // useSeoMeta({ ogImage }) writes the tag directly and beats defineOgImage,
    // so the preview was the bare skin render with no name on it.
    for (const file of [PROJECT, PROFILE]) {
      expect(read(file), file).not.toMatch(/^\s*ogImage:/m)
    }
  })

  it('render postaci ma adres bezwzgledny', () => {
    // origin comes from useRequestURL, so the server can fetch its own route
    expect(read(PROFILE)).toMatch(/renderUrl = computed\(\(\) => \(mc\.value \? `\$\{origin\}/)
    expect(read(PROFILE)).toMatch(/headUrl = computed\(\(\) => \(mc\.value \? `\$\{origin\}/)
  })

  it('szablon przycina tytul i opis, zamiast pozwolic im wyjsc za krawedz', () => {
    const source = read(TEMPLATE)

    expect(source).toMatch(/title\.length > \d+/)
    expect(source).toMatch(/description\.length > \d+/)
  })

  it('kazdy element szablonu jest flexem', () => {
    // satori has no block layout: an element without display:flex is dropped
    const divs = read(TEMPLATE).match(/<div[^>]*class="[^"]*"/g) ?? []
    const missing = divs.filter(tag => !/\bflex\b/.test(tag))

    expect(missing).toEqual([])
  })
})

describe('favicona strony', () => {
  it('projekt nosi swoja ikone, profil glowe gracza', () => {
    expect(read(PROJECT)).toMatch(/rel: 'icon', href: project\.value\.icon, key: 'favicon'/)
    expect(read(PROFILE)).toMatch(/rel: 'icon', type: 'image\/png', href: headUrl\.value, key: 'favicon'/)
  })

  it('domyslna favicona ma ten sam klucz, wiec jest zastepowana a nie dublowana', () => {
    expect(read('nuxt.config.ts')).toMatch(/rel: 'icon'[^}]*key: 'favicon'/)
  })
})

// A cover is stored bounded on its longer side and otherwise untouched, so the
// shape belongs to whoever uploaded it. A fixed box on the article page cropped
// the top and bottom off anything taller than 3:1.
describe('okladka artykulu', () => {
  it('na stronie artykulu ma wlasna wysokosc', () => {
    const page = readFileSync('app/pages/news/[slug].vue', 'utf8')
    const cover = /<img[\s\S]*?article\.cover[\s\S]*?>/.exec(page)?.[0] ?? ''

    expect(cover).toContain('h-auto')
    expect(cover).not.toContain('object-cover')
    expect(cover).not.toMatch(/aspect-\[/)
  })

  it('podglad w edytorze pokazuje ten sam ksztalt', () => {
    const editor = readFileSync('app/components/admin/PostEditor.vue', 'utf8')
    const preview = /<img[\s\S]*?draft\.cover[\s\S]*?>/.exec(editor)?.[0] ?? ''

    expect(preview).toContain('h-auto')
    expect(preview).not.toContain('object-cover')
  })

  // Cards in a grid are the other case: they share a height or the grid breaks.
  it('kafelki na listach nadal przycinaja', () => {
    for (const file of ['app/pages/news/index.vue', 'app/components/home/NewsSection.vue']) {
      expect(readFileSync(file, 'utf8'), file).toMatch(/aspect-\[[\d/]+\] w-full object-cover/)
    }
  })
})
