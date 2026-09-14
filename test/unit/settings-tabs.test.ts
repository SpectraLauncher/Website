import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * A settings tab has to land on a page.
 *
 * Both registries build the address by gluing `to` onto the settings path, so an
 * entry naming something that is not there renders the frame with nothing
 * inside — no error, no 404, just an empty panel. Two of them shipped that way,
 * pointing at /dashboard/... because that is where the account-wide pages live.
 */
const AREAS = [
  { registry: 'app/pages/org/[slug]/settings.vue', pages: 'app/pages/org/[slug]/settings' },
  { registry: 'app/pages/[type]/[slug]/settings.vue', pages: 'app/pages/[type]/[slug]/settings' },
]

/** The `to:` of every entry in the file's TABS array. */
function tabsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  const block = /const TABS = \[([\s\S]*?)\n\] as const|const TABS = \[([\s\S]*?)\n\]/.exec(source)

  expect(block, `brak TABS w ${file}`).toBeTruthy()

  return [...(block![1] ?? block![2] ?? '').matchAll(/to: '([^']*)'/g)].map(m => m[1]!)
}

describe('zakladki ustawien prowadza do stron', () => {
  it.each(AREAS)('$registry', ({ registry, pages }) => {
    const missing = tabsOf(registry).filter((to) => {
      // '' is the index page of the area itself
      if (!to) return !existsSync(`${pages}/index.vue`)

      const name = to.replace(/^\//, '')
      return !existsSync(`${pages}/${name}.vue`) && !existsSync(`${pages}/${name}/index.vue`)
    })

    expect(missing).toEqual([])
  })

  // The shape of the bug: an entry borrowed from the account's own navigation,
  // where /dashboard/... is an absolute address rather than a name under here.
  it('zadna zakladka nie wskazuje na dashboard', () => {
    for (const { registry } of AREAS) {
      expect(tabsOf(registry), registry).not.toContainEqual(expect.stringContaining('/dashboard/'))
    }
  })
})
