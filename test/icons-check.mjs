// node test/icons-check.mjs
//
// An icon name that does not exist in the set renders as empty space — no error,
// no warning, nothing in the console. The name is a string in a template or a
// registry, so nothing else checks it. This reads every icon reference in the
// source and looks it up in the installed icon data.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// The sets we ship. Adding one means installing @iconify-json/<set> and listing
// it here.
const SETS = ['pixelarticons', 'simple-icons']

// Sets we deliberately dropped. Listing them turns a silently reintroduced icon
// into a failed check instead of a missing glyph nobody notices.
const REMOVED = ['lucide']

const ROOTS = ['app', 'server', 'shared', 'i18n', 'test']
const EXTENSIONS = new Set(['.vue', '.ts', '.json', '.mjs', '.md'])

function* walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name).split(path.sep).join('/')
    if (entry.isDirectory()) yield* walk(file)
    else if (EXTENSIONS.has(path.extname(entry.name))) yield file
  }
}

const names = new Map(SETS.map((set) => {
  const data = require(`@iconify-json/${set}/icons.json`)
  return [set, new Set([...Object.keys(data.icons), ...Object.keys(data.aliases ?? {})])]
}))

const problems = []
let checked = 0

for (const file of ROOTS.flatMap(root => [...walk(root)])) {
  const source = fs.readFileSync(file, 'utf8')

  for (const set of SETS) {
    for (const [, name] of source.matchAll(new RegExp(`\\bi-${set}-([a-z0-9][a-z0-9-]*)`, 'g'))) {
      checked++
      if (!names.get(set).has(name)) problems.push(`${file}: i-${set}-${name} is not in ${set}`)
    }
  }

  for (const set of REMOVED) {
    for (const [match] of source.matchAll(new RegExp(`\\bi-${set}-[a-z0-9-]+`, 'g'))) {
      problems.push(`${file}: ${match} — ${set} is no longer installed`)
    }
  }
}

if (problems.length) {
  console.error([...new Set(problems)].join('\n'))
  console.error(`\n${problems.length} icon reference(s) point at nothing. Pick a name that exists`)
  console.error('in one of the installed sets, or install the set and add it to SETS here.')
  process.exit(1)
}

console.log(`✓ all ${checked} icon references resolve in ${SETS.join(', ')}`)
