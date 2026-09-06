// node test/api-docs-check.mjs
//
// Every publicly reachable endpoint has to be described somewhere a reader can
// find it. Modrinth avoids this drifting by generating its API reference from
// annotations in the handlers; we have no annotation layer, so the equivalent
// is this: read the routes off disk, compare them with the reference, and fail
// when the two disagree.
//
// A hand-written API reference without a check like this is wrong within a month.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'server/api'
const REFERENCE = 'shared/utils/api-reference.ts'

// Routes nobody outside this codebase should be calling directly, so they are
// not part of the published surface.
const PRIVATE = [
  /^\/api\/auth\//,
  /^\/api\/hooks\//,
  /^\/api\/admin\//,
  /^\/api\/__sitemap__/,
  /^\/api\/telemetry$/,
  /^\/api\/internal\//,
  // Development only: it answers 404 anywhere else.
  /^\/api\/dev-cache$/,
]

function* walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else if (entry.name.endsWith('.ts')) yield p.split(path.sep).join('/')
  }
}

const METHODS = ['get', 'post', 'patch', 'put', 'delete', 'options']

// server/api/catalog/project/[slug]/versions.get.ts -> GET /api/catalog/project/{slug}/versions
function routeOf(file) {
  const rest = file.slice(`${ROOT}/`.length).replace(/\.ts$/, '')
  const parts = rest.split('.')
  const method = METHODS.includes(parts.at(-1)) ? parts.pop() : 'get'

  const url = `/api/${parts.join('.')}`
    .replace(/\/index$/, '')
    .replace(/\[\.\.\.(\w+)\]/g, '{$1}')
    .replace(/\[(\w+)\]/g, '{$1}')

  return { method: method.toUpperCase(), url }
}

const found = [...walk(ROOT)]
  .map(routeOf)
  .filter(({ url }) => !PRIVATE.some(pattern => pattern.test(url)))
  .map(({ method, url }) => `${method} ${url}`)
  .sort()

const reference = fs.readFileSync(REFERENCE, 'utf8')
const documented = [...reference.matchAll(/route: '([^']+)'/g)].map(m => m[1]).sort()

const missing = found.filter(route => !documented.includes(route))
const stale = documented.filter(route => !found.includes(route))

if (missing.length || stale.length) {
  if (missing.length) {
    console.error('Endpoints with no entry in the reference:\n'
      + missing.map(r => '  ' + r).join('\n'))
  }
  if (stale.length) {
    console.error('\nReference entries with no endpoint behind them:\n'
      + stale.map(r => '  ' + r).join('\n'))
  }
  console.error(`\nEdit ${REFERENCE}, or add the path to PRIVATE in this check if`)
  console.error('it is genuinely not part of the published API.')
  process.exit(1)
}

console.log(`✓ all ${found.length} public endpoints are in the API reference`)
