import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { cssSafeAssetUrl, safeAssetUrl } from '../../shared/utils/links'

// The drawing moved into a shared component when profiles gained a banner: a
// project's feature image and a profile's banner are the same band, and two
// copies of it would drift. ProjectBackdrop now only picks which picture.
const picker = readFileSync('app/components/project/Backdrop.vue', 'utf8')
const component = readFileSync('app/components/ui/Backdrop.vue', 'utf8')

// The page file's name is a routing decision that has changed once already
// ([[tab]] to [...tab] when versions gained their own address), and this test
// has nothing to say about which it is.
// One page serves every type now, so there is one file to read rather than six.
// Its name is a routing decision that has changed twice already, and this test
// has nothing to say about which it is.
function projectPage(): string {
  const dir = 'app/pages/[type]/[slug]'
  const file = readdirSync(dir).find(name => name.endsWith('.vue'))
  if (!file) throw new Error(`brak strony w ${dir}`)
  return readFileSync(`${dir}/${file}`, 'utf8')
}

describe('tlo strony projektu', () => {
  const header = readFileSync('app/components/catalog/Project.vue', 'utf8')

  it('strona projektu nie maluje wlasnego tla', () => {
    const page = projectPage()

    expect(page).not.toContain(`bg-[url('/bg.webp')]`)
    expect(page).not.toContain('bg-cover bg-center')
  })

  // The banner is a band inside the header card now, so the header renders it
  // once for every type rather than each page rendering it for itself.
  it('naglowek projektu jest jedynym miejscem, ktore je zamawia', () => {
    expect(projectPage()).not.toContain('<ProjectBackdrop')
    expect(header).toContain('<ProjectBackdrop :banner="project.banner" />')
  })

  // A gallery image used to be tickable as the banner, which put a 1920x560
  // picture into a list of screenshots and showed it as one.
  it('galeria nie jest juz zrodlem baneru', () => {
    expect(picker).not.toContain('featured')
    expect(picker).not.toContain('gallery')
    expect(picker).toContain('<UiBackdrop :image="banner" />')
  })

  it('bez wyroznionego obrazu nie ma pasa', () => {
    expect(component).not.toContain(`'/bg.webp'`)
    expect(component).toContain('v-if="url"')
  })

  // Tailwind resolves its arbitrary values when it builds, so a runtime URL can
  // never be a class. It is an <img> src now rather than a background.
  it('adres nie trafia do klasy, bo klasa nie zna go przy buildzie', () => {
    expect(component).toContain(':src="url"')
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
