import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

import { expect, it } from 'vitest'

// <component :is="'NuxtLink'"> does not resolve the name — Vue renders an
// unknown <nuxtlink> element instead, with no error anywhere. It looks right,
// it is styled right, and it does nothing when clicked. That shipped three
// times: the account sidebar, the loader marks and the notification rows.
//
// resolveComponent() in setup is the way to name a component, and it is what
// UiPanel and UiGlassCard already do.
const ROOTS = ['app/components', 'app/pages', 'app/layouts']

function* files(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name).split(sep).join('/')
    if (entry.isDirectory()) yield* files(path)
    else if (entry.name.endsWith('.vue')) yield path
  }
}

// A lowercase literal is a native tag — 'button', 'span', 'div' — and resolves
// fine. An uppercase one is a component name and never will.
const NAMED = /:is="[^"]*'([A-Z][A-Za-z0-9]*)'/g

it('zaden :is nie podaje nazwy komponentu jako tekstu', () => {
  const problems: string[] = []

  for (const root of ROOTS) {
    for (const file of files(root)) {
      for (const [, name] of readFileSync(file, 'utf8').matchAll(NAMED)) {
        problems.push(`${file}: :is="… '${name}' …" — uzyj resolveComponent('${name}')`)
      }
    }
  }

  expect(problems).toEqual([])
})
