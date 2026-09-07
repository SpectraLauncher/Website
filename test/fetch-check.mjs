// node test/fetch-check.mjs
//
// A page that calls an endpoint nobody wrote gets a 404, and the call sites here
// wrap their fetches in try/catch so the page keeps rendering with an empty
// list. Nothing fails, nothing is logged where anyone looks, and the feature is
// simply missing — which is how /api/admin/catalog/vocabulary survived.
//
// This reads every literal /api/... path out of the app and matches it against
// the routes on disk.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'server/api'
const METHODS = ['get', 'post', 'patch', 'put', 'delete', 'options']

// Endpoints better-auth mounts itself, under one catch-all handler.
const EXTERNAL = [/^\/api\/auth\//]

function* walk(dir, exts) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name).split(path.sep).join('/')
    if (entry.isDirectory()) yield* walk(file, exts)
    else if (exts.some(ext => entry.name.endsWith(ext))) yield file
  }
}

// server/api/catalog/project/[slug]/versions.get.ts -> /api/catalog/project/:/versions
function pattern(file) {
  const rest = file.slice(`${ROOT}/`.length).replace(/\.ts$/, '')
  const parts = rest.split('.')
  if (METHODS.includes(parts.at(-1))) parts.pop()

  return `/api/${parts.join('.')}`
    .replace(/\/index$/, '')
    .replace(/\[\.\.\.\w+\]/g, '**')
    .replace(/\[\w+\]/g, '*')
}

const routes = [...walk(ROOT, ['.ts'])].map(pattern)

// A call site's dynamic segments are template holes or variables; both become *.
function normalise(url) {
  return url
    .replace(/\$\{[^}]*\}/g, '*')
    .replace(/\/+$/, '')
}

function matches(url) {
  return routes.some((route) => {
    if (route.includes('**')) return url.startsWith(route.slice(0, route.indexOf('**')))

    const a = route.split('/')
    const b = url.split('/')
    if (a.length !== b.length) return false
    return a.every((part, i) => part === '*' || b[i] === '*' || part === b[i])
  })
}

const problems = []
let checked = 0

for (const file of walk('app', ['.vue', '.ts'])) {
  const source = fs.readFileSync(file, 'utf8')

  for (const [, url] of source.matchAll(/['"`](\/api\/[^'"`\s?]*)/g)) {
    const clean = normalise(url)
    if (EXTERNAL.some(pattern => pattern.test(clean))) continue

    checked++
    if (!matches(clean)) problems.push(`${file}: ${url} has no handler in ${ROOT}`)
  }
}

if (problems.length) {
  console.error([...new Set(problems)].join('\n'))
  console.error('\nWrite the handler, or fix the path. A missing one answers 404 and the')
  console.error('caller usually swallows it, so nothing else will tell you.')
  process.exit(1)
}

console.log(`✓ all ${checked} API calls in the app reach a route that exists`)
