import { readdirSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function pages(dir = 'app/pages'): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) return pages(path)
    return entry.name.endsWith('.vue') ? [path] : []
  })
}

// app.vue renders the footer once, after <NuxtPage />. A page adding its own
// gets two, and it is the kind of thing that only shows up by scrolling.
describe('stopka nalezy do app.vue', () => {
  it('zadna strona nie renderuje wlasnej', () => {
    const guilty = pages().filter(page => readFileSync(page, 'utf8').includes('<SiteFooter'))
    expect(guilty).toEqual([])
  })

  it('app.vue nadal ja ma', () => {
    expect(readFileSync('app/app.vue', 'utf8')).toContain('<SiteFooter />')
  })
})
