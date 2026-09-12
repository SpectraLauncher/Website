// node --experimental-strip-types test/imports-check.mjs
//
// Every explicit ~/… and ~~/… import has to point at a file that exists.
//
// This shipped broken: the Minecraft tool files moved into app/utils/mc and six
// pages kept importing them from the old path. Nothing caught it — vitest never
// builds the pages, and the auto-import check only looks at what is exported,
// not at what is imported by hand. The first thing to notice was the production
// build failing, which is the most expensive place to find out.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

const EXT = ['.ts', '.vue', '.js', '.mjs', '/index.ts', '/index.vue', '/index.js']

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory()
    ? walk(join(dir, entry.name))
    : [join(dir, entry.name)]))
}

const roots = ['app', 'shared', 'server'].filter(existsSync)
const files = roots.flatMap(walk).filter(f => /\.(ts|vue|mjs)$/.test(f))

// ~ is app/, ~~ and @@ are the project root, @ is app/ as well.
const resolve = (spec, from) => {
  if (spec.startsWith('~~/') || spec.startsWith('@@/')) return spec.slice(3)
  if (spec.startsWith('~/') || spec.startsWith('@/')) return join('app', spec.slice(2))
  // Relative imports inside the repo count too: moving an export out of a module
  // leaves these pointing at a name that is no longer there, and that is a build
  // failure rather than a type error.
  if (spec.startsWith('./') || spec.startsWith('../')) return join(from, '..', spec)
  return null
}

const fileFor = (base) => (existsSync(base) && /\.(ts|vue|js|mjs)$/.test(base)
  ? base
  : EXT.map(ext => base + ext).find(existsSync))

/** What a module offers by name. Cheap and textual, which is enough here. */
const exportsOf = (file) => {
  const source = readFileSync(file, 'utf8')
  const names = new Set()

  for (const m of source.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1])
  }
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim()
      if (name) names.add(name)
    }
  }

  // A re-export means anything could be in there; do not guess.
  const wildcard = /export\s+\*/.test(source)
  return { names, wildcard }
}

const broken = []

for (const file of files) {
  const source = readFileSync(file, 'utf8')

  for (const match of source.matchAll(/import\s+(?:type\s+)?(?:\{([^}]*)\}\s*from\s*)?['"]([^'"]+)['"]/g)) {
    const base = resolve(match[2], file)
    if (!base) continue

    const target = fileFor(base)
    if (!target) {
      broken.push(`${file.split(sep).join('/')} → ${match[2]} (no such file)`)
      continue
    }

    if (!match[1] || target.endsWith('.vue')) continue

    const { names, wildcard } = exportsOf(target)
    if (wildcard) continue

    for (const part of match[1].split(',')) {
      const wanted = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]?.trim()
      if (!wanted || names.has(wanted)) continue

      broken.push(`${file.split(sep).join('/')} → ${match[2]} does not export ${wanted}`)
    }
  }
}

if (broken.length) {
  console.error(`${broken.length} import(s) point at a file that does not exist:\n`)
  for (const line of broken) console.error(`  ${line}`)
  console.error('\nA moved file needs its importers moved with it. This fails the'
    + '\nproduction build, and nothing else in the suite would notice.')
  process.exit(1)
}

console.log(`✓ all ${files.length} source files resolve every ~ and ~~ import they name`)
