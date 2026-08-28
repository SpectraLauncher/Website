// node test/autoimport-check.mjs
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const store = path.join(process.cwd(), 'node_modules/.pnpm')
const pkg = fs.readdirSync(store).find(name => name.startsWith('unimport@'))
if (!pkg) throw new Error('nie znalazlem unimport w node_modules/.pnpm')
const { scanExports } = await import(pathToFileURL(path.join(store, pkg, 'node_modules/unimport/dist/index.mjs')))

const ROOTS = ['app/utils', 'app/composables', 'server/utils']
const DECLARED = /^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/gm

function* walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else if (entry.name.endsWith('.ts')) yield p.split(path.sep).join('/')
  }
}

const problems = []

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, 'utf8')
    const declared = [...src.matchAll(DECLARED)].map(m => m[1])
    const seen = new Set((await scanExports(file)).map(e => e.name))
    const missing = declared.filter(name => !seen.has(name))
    if (missing.length) problems.push(`${file} — skaner nie widzi: ${missing.join(', ')}`)
  }
}

if (problems.length) {
  console.error('Eksporty niewidoczne dla auto-importu:\n' + problems.map(p => '  ' + p).join('\n'))
  console.error('\nNajczestsza przyczyna: jednolinijkowy `export const X = { ... }` tuz nad eksportem,')
  console.error('ktory znika. Rozbij ten obiekt na kilka linii albo przenizej deklaracje.')
  process.exit(1)
}

console.log('✓ kazdy eksport z utils i composables jest widoczny dla auto-importu')
