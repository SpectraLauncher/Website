import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

// The browser's own dialogs block the page, cannot be styled, and some browsers
// offer to suppress every later one — which turns "delete this organization?"
// into a silent yes. useConfirm exists for that reason and the editor's link
// dialog for the same one; this keeps the next one from slipping back in.
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory()
    ? walk(join(dir, entry.name))
    : [join(dir, entry.name)]))
}

// Comments explain why they are avoided; only calls count.
const code = (file: string) => readFileSync(file, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')

const sources = walk('app').filter(file => file.endsWith('.vue') || file.endsWith('.ts'))

describe('okna przegladarki', () => {
  it('nikt nie wola prompt, confirm ani alert', () => {
    const offenders = sources
      .filter(file => /\b(?:window\.)?(?:prompt|alert)\s*\(|\bwindow\.confirm\s*\(/.test(code(file)))
      .map(file => file.split(sep).join('/'))

    expect(offenders).toEqual([])
  })
})
