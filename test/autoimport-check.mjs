// node test/autoimport-check.mjs
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const store = path.join(process.cwd(), 'node_modules/.pnpm')
const pkg = fs.readdirSync(store).find(name => name.startsWith('unimport@'))
if (!pkg) throw new Error('nie znalazlem unimport w node_modules/.pnpm')
const { scanExports } = await import(pathToFileURL(path.join(store, pkg, 'node_modules/unimport/dist/index.mjs')))

const ROOTS = ['app/utils', 'app/composables', 'server/utils', 'shared/utils']
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

// Dwa pliki eksportujace ta sama nazwe do jednego kontekstu to cichy wybor za
// nas: unimport bierze jeden i ignoruje drugi, a ktory — zalezy od kolejnosci
// skanowania. Kiedy obie wersje robia to samo, jest to tylko warning przy
// starcie; kiedy sie roznia, wywolanie trafia w inna funkcje, niz ktokolwiek
// pisal.
//
// Kontekst klienta i serwera sa osobne, wiec ta sama nazwa w app/utils i
// server/utils nie koliduje. shared/utils wchodzi do obu, wiec liczy sie tu
// dwa razy.
const SCOPES = {
  klient: ['app/utils', 'app/composables', 'shared/utils'],
  serwer: ['server/utils', 'shared/utils'],
}

const exportsOf = new Map()

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, 'utf8')
    const declared = [...src.matchAll(DECLARED)].map(m => m[1])
    const seen = new Set((await scanExports(file)).map(e => e.name))
    const missing = declared.filter(name => !seen.has(name))
    if (missing.length) problems.push(`${file} — skaner nie widzi: ${missing.join(', ')}`)

    exportsOf.set(file, seen)
  }
}

const clashes = []

for (const [scope, roots] of Object.entries(SCOPES)) {
  const owners = new Map()

  for (const [file, names] of exportsOf) {
    if (!roots.some(root => file.startsWith(root + '/'))) continue
    for (const name of names) {
      if (!owners.has(name)) owners.set(name, [])
      owners.get(name).push(file)
    }
  }

  for (const [name, files] of owners) {
    if (files.length > 1) clashes.push(`  [${scope}] ${name} — ${files.join(', ')}`)
  }
}

if (clashes.length) {
  console.error('Ta sama nazwa w jednym kontekscie auto-importu — wybrany zostanie jeden plik:\n'
    + clashes.join('\n'))
  console.error('\nZwykle winny jest reeksport, ktory niczemu nie sluzy: skoro caly katalog jest')
  console.error('auto-importowany, `export { x }` z drugiego pliku nic nie dodaje.')
  console.error('Usun reeksport albo przemianuj jedna z funkcji.')
  process.exit(1)
}

if (problems.length) {
  console.error('Eksporty niewidoczne dla auto-importu:\n' + problems.map(p => '  ' + p).join('\n'))
  console.error('\nNajczestsza przyczyna: jednolinijkowy `export const X = { ... }` tuz nad eksportem,')
  console.error('ktory znika. Rozbij ten obiekt na kilka linii albo przenizej deklaracje.')
  process.exit(1)
}

console.log('✓ kazdy eksport z utils i composables jest widoczny dla auto-importu')
