import { readFileSync, readdirSync } from 'node:fs'
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

it('kazda strona renderuje nawigacje', () => {
  const found = [...pages('app/pages')]
  expect(found.length).toBeGreaterThan(20)

  for (const path of found) {
    if (BARE.includes(path)) continue

    const source = readFileSync(path, 'utf8')
    expect(CHROME.some(tag => source.includes(tag)), path).toBe(true)
  }
})
