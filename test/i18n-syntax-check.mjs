// node test/i18n-syntax-check.mjs
//
// Every message has to compile.
//
// vue-i18n's messages are a small language, not plain strings: `@` starts a
// linked message, `|` separates plurals, `{` opens a placeholder. A message
// that breaks one of those rules compiles to nothing and throws when it is
// first rendered — and in a production build the message is stripped, so what
// reaches the logs is a bare error code.
//
// "you@example.com" in a placeholder took the home page, the article list and
// every article down with code 10, INVALID_LINKED_FORMAT, and the only thing
// production could say about it was "10".
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const store = 'node_modules/.pnpm'
const pkg = fs.readdirSync(store).find(name => name.startsWith('@intlify+message-compiler@'))
if (!pkg) {
  console.error('nie znalazlem @intlify/message-compiler — czy zaleznosci sa zainstalowane?')
  process.exit(1)
}

// pathToFileURL because a Windows absolute path is not a URL the ESM loader takes
const { baseCompile } = await import(pathToFileURL(
  path.resolve(store, pkg, 'node_modules/@intlify/message-compiler/dist/message-compiler.mjs'),
).href)

const LOCALES = fs.readdirSync('i18n/locales').filter(name => name.endsWith('.json'))

const broken = []
let checked = 0

function walk(node, locale, trail) {
  for (const [key, value] of Object.entries(node)) {
    const here = trail ? `${trail}.${key}` : key

    if (typeof value === 'string') {
      checked++
      try {
        baseCompile(value, { onError: (e) => { throw e } })
      }
      catch (e) {
        broken.push({ locale, key: here, value, code: e.code })
      }
    }
    else if (value && typeof value === 'object') {
      walk(value, locale, here)
    }
  }
}

for (const file of LOCALES) {
  walk(JSON.parse(fs.readFileSync(path.join('i18n/locales', file), 'utf8')), file.replace('.json', ''), '')
}

if (broken.length) {
  console.error(`${broken.length} komunikat(ow) nie kompiluje sie:\n`)
  for (const row of broken) {
    console.error(`  [${row.locale}] ${row.key}`)
    console.error(`    ${JSON.stringify(row.value)}`)
    console.error(`    kod ${row.code}\n`)
  }
  console.error("Najczestsza przyczyna to niezaescapowane @ — napisz je jako {'@'}.")
  console.error('Pion, | i { maja w tym jezyku znaczenie i tez wymagaja escapowania.')
  process.exit(1)
}

console.log(`✓ all ${checked} messages across ${LOCALES.length} locales compile`)
