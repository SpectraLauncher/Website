// node test/serveronly-check.mjs
//
// server/utils is auto-imported on the server only. A page that reaches for one
// of its exports still renders during SSR, because there the name resolves —
// then hydration runs the same code in the browser, the name is not in the
// bundle, and the page dies with "X is not defined". Nothing in the build says
// a word about it: it is not a type error and not a missing module.
//
// A constant both sides need belongs in shared/utils, which is auto-imported by
// both. This finds the ones that did not make it there yet.
import fs from 'node:fs'
import path from 'node:path'

// Types are erased before the bundle, so only runtime values can go missing.
const VALUE = /^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/gm
const ANY = /^export\s+(?:async\s+)?(?:function|const|let|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/gm

function* walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name).split(path.sep).join('/')
    if (entry.isDirectory()) yield* walk(file)
    else yield file
  }
}

function exported(dirs, pattern) {
  const out = new Set()
  for (const dir of dirs) {
    for (const file of walk(dir)) {
      if (!file.endsWith('.ts')) continue
      for (const [, name] of fs.readFileSync(file, 'utf8').matchAll(new RegExp(pattern.source, pattern.flags))) {
        out.add(name)
      }
    }
  }
  return out
}

// Strings carry i18n keys, URLs and class names that collide with real export
// names. None of them is a reference, so they go before anything is matched.
function code(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
}

const serverOnly = [...exported(['server/utils'], VALUE)]
  .filter(name => !exported(['app/utils', 'app/composables', 'shared/utils'], ANY).has(name))

const problems = []

for (const file of walk('app')) {
  if (!/\.(vue|ts)$/.test(file)) continue
  const source = code(fs.readFileSync(file, 'utf8'))

  for (const name of serverOnly) {
    // not a property access: pctx.translate is a method, not a missing import
    if (!new RegExp(`(?<![.\\w$])${name}\\b`).test(source)) continue
    if (new RegExp(`import[^;]*\\b${name}\\b[^;]*from`).test(source)) continue
    if (new RegExp(`(?:const|let|var|function|class)\\s+${name}\\b`).test(source)) continue
    if (new RegExp(`[{,]\\s*${name}\\s*[,}:=]`).test(source)) continue

    problems.push(`${file}: ${name} is only auto-imported on the server`)
  }
}

if (problems.length) {
  console.error(problems.join('\n'))
  console.error('\nMove the export to shared/utils, which both sides auto-import, or import it')
  console.error('explicitly in the page if it really is server-only and safe to bundle.')
  process.exit(1)
}

console.log(`✓ no page reaches for one of the ${serverOnly.length} server-only exports`)
