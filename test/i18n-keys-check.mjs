// node test/i18n-keys-check.mjs
//
// A missing translation is not an error anywhere. vue-i18n prints the key in
// place of the text, logs a warning to a console nobody has open, and the page
// renders. That is how catalog.license and catalog.admin.types.plugin both
// reached production.
//
// This reads every literal key passed to t() out of the app and looks it up in
// each locale file.
import fs from 'node:fs'
import path from 'node:path'

const LOCALES = ['en', 'pl']

// Keys built at runtime — t(`catalog.admin.types.${id}`) — cannot be checked by
// reading the source. The registries behind them are covered by
// test/unit/i18n-registries.test.ts instead.
const DYNAMIC = /\$\{|\+/

function* walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name).split(path.sep).join('/')
    if (entry.isDirectory()) yield* walk(file)
    else if (/\.(vue|ts)$/.test(entry.name)) yield file
  }
}

const dicts = Object.fromEntries(LOCALES.map(loc =>
  [loc, JSON.parse(fs.readFileSync(`i18n/locales/${loc}.json`, 'utf8'))]))

function has(dict, key) {
  return key.split('.').reduce((node, part) =>
    (node && typeof node === 'object' ? node[part] : undefined), dict) !== undefined
}

// t('a.b'), $t("a.b"), tm(`a.b`) — the quote style and the wrapper both vary.
// The trailing character says whether the literal is the whole key or only the
// prefix of one glued together with +.
const CALL = /\b(?:\$?t|tm|rt)\(\s*(['"`])([^'"`]+)\1\s*(.?)/g

const problems = []
const seen = new Set()

for (const file of walk('app')) {
  const source = fs.readFileSync(file, 'utf8')

  for (const [, , key, next] of source.matchAll(CALL)) {
    // Not every t() is vue-i18n: some helpers take a plain string.
    if (DYNAMIC.test(key) || next === '+' || key.endsWith('.')) continue
    if (!key.includes('.')) continue

    seen.add(key)
    for (const loc of LOCALES) {
      if (!has(dicts[loc], key)) problems.push(`${file}: ${key} is missing from ${loc}`)
    }
  }
}

if (problems.length) {
  console.error([...new Set(problems)].join('\n'))
  console.error('\nAdd the key to i18n/locales/*.json. vue-i18n prints the key itself when it')
  console.error('cannot find one, so nothing else will fail.')
  process.exit(1)
}

console.log(`✓ all ${seen.size} translation keys used in the app exist in ${LOCALES.join(', ')}`)
