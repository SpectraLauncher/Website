import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

// A --color-<name> in @theme generates bg-<name>, text-<name>, border-<name>
// and ring-<name>. When <name> is one Tailwind already uses as a bare utility,
// the colour wins and the utility silently changes meaning.
//
// --color-inset did exactly that: `ring ring-inset` — which app.config.ts uses
// on inputs, badges, cards and selects — stopped meaning "draw the ring inside"
// and started meaning "draw the ring in panel colour". Every checkbox in the
// API-token form became a box whose edge was the same colour as the card behind
// it, so it looked like there was no checkbox at all.
const RESERVED = [
  // ring / shadow position and style
  'inset', 'solid', 'dashed', 'dotted', 'double', 'none', 'hidden',
  // keywords the colour utilities already answer to
  'current', 'transparent', 'inherit', 'auto',
  // bg-* utilities that are not colours
  'fixed', 'local', 'scroll', 'cover', 'contain', 'repeat', 'clip', 'origin',
  'center', 'top', 'bottom', 'left', 'right',
]

const css = readFileSync('app/assets/css/main.css', 'utf8')
const theme = css.slice(css.indexOf('@theme'), css.indexOf('}', css.indexOf('@theme')))

const declared = [...theme.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map(match => match[1]!)

describe('tokeny motywu', () => {
  it('cos jest zadeklarowane', () => {
    expect(declared.length).toBeGreaterThan(0)
  })

  it('zadna nazwa koloru nie przykrywa utility Tailwinda', () => {
    expect(declared.filter(name => RESERVED.includes(name))).toEqual([])
  })

  it('kazda nazwa jest uzyta gdziekolwiek w app/', () => {
    const used = new Set<string>()

    function* files(dir: string): Generator<string> {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name).split(sep).join('/')
        if (entry.isDirectory()) yield* files(path)
        else if (entry.name.endsWith('.vue')) yield path
      }
    }

    for (const root of ['app/components', 'app/pages', 'app/layouts']) {
      for (const file of files(root)) {
        const source = readFileSync(file, 'utf8')
        for (const name of declared) {
          if (new RegExp(String.raw`\b(?:bg|text|border|divide|ring)-${name}\b`).test(source)) used.add(name)
        }
      }
    }

    expect(declared.filter(name => !used.has(name))).toEqual([])
  })
})
