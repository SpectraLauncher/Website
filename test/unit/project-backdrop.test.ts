import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { cssSafeAssetUrl, safeAssetUrl } from '../../shared/utils/links'

const component = readFileSync('app/components/project/Backdrop.vue', 'utf8')

const TYPES = ['mod', 'pack', 'plugin', 'resourcepack', 'schematic', 'shader']

describe('tlo strony projektu', () => {
  it.each(TYPES)('%s uzywa komponentu, nie wlasnego diva', (type) => {
    const page = readFileSync(`app/pages/${type}/[slug]/[[tab]].vue`, 'utf8')

    expect(page).toContain('<ProjectBackdrop :gallery="data?.gallery ?? []" />')
    expect(page).not.toContain(`bg-[url('/bg.webp')]`)
  })

  // Six pages carried the same markup, and a change to one of them was a change
  // to none of the others.
  it('zostaje jedno miejsce, w ktorym to tlo istnieje', () => {
    const owners = TYPES.filter(type =>
      readFileSync(`app/pages/${type}/[slug]/[[tab]].vue`, 'utf8').includes('bg-cover bg-center'))

    expect(owners).toEqual([])
    expect(component).toContain('bg-cover bg-center')
  })

  it('domyslne tlo zostaje, kiedy nic nie jest wyroznione', () => {
    expect(component).toContain(`'/bg.webp'`)
  })

  // Tailwind resolves its arbitrary values when it builds, so a runtime URL has
  // to go through style, not through a class.
  it('obraz idzie przez style, bo klasa nie zna go przy buildzie', () => {
    expect(component).toContain('backgroundImage')
    expect(component).not.toMatch(/bg-\[url\(\$\{/)
  })
})

// The value lands inside a CSS url(). safeAssetUrl vouches for the scheme and
// the host and percent-encodes quotes, but it leaves parentheses and
// apostrophes alone - and a bare ')' closes the url() early, after which the
// rest is read as more CSS.
describe('adres obrazu przed wstawieniem w CSS', () => {
  it('komponent uzywa wspolnego filtra', () => {
    expect(component).toContain('cssSafeAssetUrl(')
  })

  // safeAssetUrl lets this through as a%22).evil(%22 - the quotes are encoded
  // and the parentheses are not, which is the whole reason for a second pass.
  it('odrzuca adres, ktory wychodzi z url()', () => {
    expect(safeAssetUrl('https://cdn.example.com/a").evil("')).toContain(')')
    expect(cssSafeAssetUrl('https://cdn.example.com/a").evil("')).toBeNull()
  })

  it.each([
    "https://cdn.example.com/a'.png",
    'https://cdn.example.com/a(b).png',
  ])('%s nie przechodzi', (url) => {
    expect(cssSafeAssetUrl(url)).toBeNull()
  })

  // Both of these come back from safeAssetUrl already made safe - the space
  // percent-encoded, the backslash normalised to a slash - so there is nothing
  // left to reject.
  it.each([
    ['/uploads/shot.webp', '/uploads/shot.webp'],
    ['https://cdn.example.com/gallery/shot.webp', 'https://cdn.example.com/gallery/shot.webp'],
    ['https://cdn.example.com/a b.png', 'https://cdn.example.com/a%20b.png'],
    ['https://cdn.example.com/a\\b.png', 'https://cdn.example.com/a/b.png'],
  ])('%s przechodzi jako %s', (url, expected) => {
    expect(cssSafeAssetUrl(url)).toBe(expected)
  })

  it('brak adresu to brak tla, nie pusty url()', () => {
    for (const value of [undefined, null, '', '//evil.example.com/x.png', 'javascript:alert(1)']) {
      expect(cssSafeAssetUrl(value), String(value)).toBeNull()
    }
  })
})
