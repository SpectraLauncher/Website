import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

import { expect, it } from 'vitest'

// The navigation is fixed, so a page that forgets it does not merely look bare —
// there is no way off it, and the content sits where the bar would have been.
// Nothing in the framework enforces this and every page added during a long
// session is a chance to forget, so it is read off disk instead.
//
// A wrapper counts when rendering it is what puts the bar on the page:
// UiPageShell, CatalogBrowse and LegalPage all render SiteNavbar themselves.
const CHROME = ['<SiteNavbar', '<UiPageShell', '<CatalogBrowse', '<LegalPage']

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

// A page that names a layout is framed by it, so the bar is the layout's job.
const layout = (source: string) => /definePageMeta\([^)]*\blayout\s*:\s*['"]([\w-]+)['"]/.exec(source)?.[1]

it('kazda strona renderuje nawigacje', () => {
  const found = [...pages('app/pages')]
  expect(found.length).toBeGreaterThan(20)

  for (const path of found) {
    if (BARE.includes(path) || nested(path)) continue

    const source = readFileSync(path, 'utf8')
    const named = layout(source)

    if (named) {
      const file = `app/layouts/${named}.vue`
      expect(existsSync(file), `${path} -> ${file}`).toBe(true)
      expect(CHROME.some(tag => readFileSync(file, 'utf8').includes(tag)), file).toBe(true)
      continue
    }

    expect(CHROME.some(tag => source.includes(tag)), path).toBe(true)
  }
})

// A layout only reaches a page through <NuxtLayout>. Without it Nuxt renders the
// page alone and every layout in the directory is dead weight nobody notices —
// which is how nuxt.config's layoutTransition sat inert.
it('app.vue renderuje layout', () => {
  expect(readFileSync('app/app.vue', 'utf8')).toContain('<NuxtLayout>')
})

// A <NuxtPage /> inside a v-if is worse than a missing one: the child route
// cannot mount until the condition turns true, so a hard refresh of a nested
// tab renders nothing and Nuxt reports E4016. The condition is almost always
// "the data arrived", which is exactly when it is still false.
function conditionalNuxtPage(source: string): string | null {
  // A comment explaining why this rule exists is not a violation of it.
  const lines = source.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/)
  const at = lines.findIndex(line => line.includes('<NuxtPage'))
  if (at < 0) return null

  const indent = (line: string) => line.length - line.trimStart().length
  const own = indent(lines[at]!)

  // Walk out to the template root, and for each ancestor read the whole opening
  // tag — attributes often sit on their own lines.
  let depth = own
  for (let i = at - 1; i >= 0; i--) {
    const line = lines[i]!
    if (!line.trim() || !line.trimStart().startsWith('<')) continue
    if (indent(line) >= depth) continue

    depth = indent(line)

    let tag = line
    for (let j = i + 1; j < at && !/\/?>\s*$/.test(tag.trim()); j++) tag += lines[j]

    if (/\sv-if=/.test(tag)) return tag.trim().slice(0, 80)
    if (depth === 0) break
  }

  return null
}

it('zaden NuxtPage nie siedzi w v-if', () => {
  for (const path of pages('app/pages')) {
    const found = conditionalNuxtPage(readFileSync(path, 'utf8'))
    expect(found, `${path}: ${found}`).toBeNull()
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
