import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

import { expect, it } from 'vitest'

// The navigation is fixed, so a page that forgets it does not merely look bare —
// there is no way off it, and the content sits where the bar would have been.
// Nothing in the framework enforces this and every page added during a long
// session is a chance to forget, so it is read off disk instead.
const CHROME = ['<Navbar', '<CatalogBrowse', '<LegalPage']

// Pages that legitimately render nothing. A redirect has no interface to frame.
const BARE = ['app/pages/account.vue']

function* pages(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name).split(sep).join('/')
    if (entry.isDirectory()) yield* pages(path)
    else if (entry.name.endsWith('.vue')) yield path
  }
}

// app/pages/org/[slug]/settings/members.vue is rendered inside
// app/pages/org/[slug]/settings.vue, which is where the navigation lives. Nuxt
// makes a route a child when a .vue file sits beside a directory of the same
// name, so the same rule finds them here.
function nested(path: string): boolean {
  const parts = path.split('/')

  for (let i = parts.length - 1; i > 2; i--) {
    if (existsSync(`${parts.slice(0, i).join('/')}.vue`)) return true
  }

  return false
}

it('kazda strona renderuje nawigacje', () => {
  const found = [...pages('app/pages')]
  expect(found.length).toBeGreaterThan(20)

  for (const path of found) {
    if (BARE.includes(path) || nested(path)) continue

    const source = readFileSync(path, 'utf8')
    expect(CHROME.some(tag => source.includes(tag)), path).toBe(true)
  }
})

// A parent that forgets <NuxtPage /> renders an empty frame: the tabs are there,
// the tab does nothing, and nothing errors.
it('kazda trasa nadrzedna renderuje swoje dzieci', () => {
  for (const path of pages('app/pages')) {
    if (!nested(path)) continue

    const parts = path.split('/')
    const parent = parts.slice(0, parts.length - 1).join('/') + '.vue'
    if (!existsSync(parent)) continue

    expect(readFileSync(parent, 'utf8').includes('<NuxtPage'), parent).toBe(true)
  }
})
