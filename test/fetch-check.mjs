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

// server/api/catalog/project/[slug]/versions.get.ts -> GET /api/catalog/project/*/versions
function route(file) {
  const rest = file.slice(`${ROOT}/`.length).replace(/\.ts$/, '')
  const parts = rest.split('.')
  const method = METHODS.includes(parts.at(-1)) ? parts.pop().toUpperCase() : 'GET'

  const url = `/api/${parts.join('.')}`
    .replace(/\/index$/, '')
    .replace(/\[\.\.\.\w+\]/g, '**')
    .replace(/\[\w+\]/g, '*')

  return { method, url }
}

const routes = [...walk(ROOT, ['.ts'])].map(route)

// A call site's dynamic segments are template holes or variables; both become *.
function normalise(url) {
  return url
    .replace(/\$\{[^}]*\}/g, '*')
    .replace(/\/+$/, '')
}

function samePath(pattern, url) {
  if (pattern.includes('**')) return url.startsWith(pattern.slice(0, pattern.indexOf('**')))

  const a = pattern.split('/')
  const b = url.split('/')
  if (a.length !== b.length) return false
  return a.every((part, i) => part === '*' || b[i] === '*' || part === b[i])
}

const problems = []
let checked = 0

for (const file of walk('app', ['.vue', '.ts'])) {
  const source = fs.readFileSync(file, 'utf8')

  // The method sits in the options object after the url, usually a line or two
  // down. A route file that does not name one answers GET.
  // The tail is a lookahead so it is not consumed: two calls a few lines apart
  // must both be seen, not swallowed by the first one's window.
  for (const [, url, tail] of source.matchAll(/['"`](\/api\/[^'"`\s?]*)(?=([\s\S]{0,300}))/g)) {
    const clean = normalise(url)
    if (EXTERNAL.some(pattern => pattern.test(clean))) continue

    checked++

    if (!routes.some(r => samePath(r.url, clean))) {
      problems.push(`${file}: ${url} has no handler in ${ROOT}`)
      continue
    }

    // `method: next ? 'POST' : 'DELETE'` is chosen at runtime; only the path can
    // be checked for those.
    const options = /^[^)]*/.exec(tail)[0]
    const named = /method:\s*['"]([a-zA-Z]+)['"]/.exec(options)
    if (!named && /method:/.test(options)) continue

    const method = (named?.[1] ?? 'GET').toUpperCase()
    if (!routes.some(r => r.method === method && samePath(r.url, clean))) {
      problems.push(`${file}: ${method} ${url} — the route exists but not for that method`)
    }
  }
}

// A plain $fetch inside useAsyncData runs on the server with none of the
// browser's cookies, so anything behind a login answers 401 during SSR and the
// payload carries that failure into the browser: the page reads as "no rights"
// on a direct visit and works when reached by a link. useRequestFetch passes
// the incoming request's headers through, and is $fetch on the client.
let handlers = 0

for (const file of walk('app', ['.vue', '.ts'])) {
  const source = fs.readFileSync(file, 'utf8')

  for (const call of source.matchAll(/useAsyncData\(/g)) {
    let depth = 0
    let end = source.length

    for (let i = call.index + call[0].length - 1; i < source.length; i++) {
      if (source[i] === '(') depth++
      else if (source[i] === ')') {
        depth--
        if (!depth) { end = i; break }
      }
    }

    handlers++

    if (/[^.\w]\$fetch[<(]/.test(source.slice(call.index, end))) {
      const line = source.slice(0, call.index).split('\n').length
      problems.push(`${file}:${line} — useAsyncData calls $fetch; use useRequestFetch() `
        + 'so the session survives server rendering')
    }
  }
}

if (problems.length) {
  console.error([...new Set(problems)].join('\n'))
  console.error('\nWrite the handler, or fix the path. A missing one answers 404 and the')
  console.error('caller usually swallows it, so nothing else will tell you.')
  process.exit(1)
}

console.log(`✓ all ${checked} API calls in the app reach a route that exists,`)
console.log(`  and all ${handlers} useAsyncData handlers keep their cookies through SSR`)
