// node test/responsive-check.mjs
//
// Classes that push a page sideways on a narrow screen. Nobody sees this on a
// monitor, and phones are most of the traffic.
//
// Deliberately narrow. A check that shouts at correct code stops being read
// within a week, so only patterns that are always wrong live here: overflow,
// not taste.
//
// Grid column counts are not checked. Statically there is no way to see what
// sits in a cell — eight columns of 24px emoji fit, three columns of cards do
// not — and a rule on the number alone produced nothing but false positives.
import fs from 'node:fs'
import path from 'node:path'

const ROOTS = ['app/components', 'app/pages', 'app/layouts']

// Rendered by satori into a fixed-width image, never in a browser.
const SKIP = /app\/components\/OgImage\//

function* walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else if (entry.name.endsWith('.vue')) yield p.split(path.sep).join('/')
  }
}

const PREFIXED = /^(sm|md|lg|xl|2xl|max-sm|max-md|max-lg|hover|focus|group|peer|dark|print):/

function classAttributes(source) {
  return [...source.matchAll(/(?:^|\s)(?::?class)="([^"]*)"/g)].map(m => m[1])
}

function bareClasses(attr) {
  return attr.split(/\s+/)
    .map(raw => raw.replace(/^['"`]|['"`,]$/g, '').trim())
    .filter(cls => cls && !PREFIXED.test(cls))
}

const problems = []

for (const root of ROOTS) {
  for (const file of walk(root)) {
    if (SKIP.test(file)) continue

    const source = fs.readFileSync(file, 'utf8')
    // A pixel width is fine when something above it scrolls.
    const scrolls = /overflow-x-auto|overflow-auto|overflow-x-scroll/.test(source)

    for (const attr of classAttributes(source)) {
      for (const cls of bareClasses(attr)) {
        if (/^(w|min-w)-\[\d{3,}px\]$/.test(cls) && !scrolls) {
          problems.push(`${file} — "${cls}" bez przewijania nad soba rozpycha strone`)
        }
      }
    }

    // Text people type arrives whole. Pre-wrap breaks on spaces and a pasted
    // address has none, so one long link widens the container.
    for (const attr of classAttributes(source)) {
      if (/whitespace-pre-wrap/.test(attr) && !/break-words|break-all/.test(attr)) {
        problems.push(`${file} — whitespace-pre-wrap bez break-words, dlugi adres sie nie zlamie`)
      }
    }

    if (/<table\b/.test(source) && !scrolls) {
      problems.push(`${file} — <table> bez kontenera z overflow-x-auto`)
    }
  }
}

if (problems.length) {
  console.error('Klasy, ktore rozpychaja strone na telefonie:\n'
    + [...new Set(problems)].map(p => '  ' + p).join('\n'))
  process.exit(1)
}

console.log('✓ nic nie wymusza szerokosci wiekszej niz ekran')
