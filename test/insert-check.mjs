// node test/insert-check.mjs
//
// Two INSERT statements in this codebase passed a parameter the query never
// referenced, and both were missing the same thing: the `id` column. Neither is
// a type error and neither shows up until somebody runs it, because the column
// list, the VALUES list and the parameter array are three separate things that
// have to agree and nothing was checking that they did.
import fs from 'node:fs'
import path from 'node:path'

// Tables whose primary key we have to supply ourselves. Anything declared
// `<col> TEXT PRIMARY KEY` with no DEFAULT is one of them.
function generatedKeys() {
  const needs = new Map()

  for (const file of walk('server/utils')) {
    if (!path.basename(file).startsWith('schema')) continue
    const source = fs.readFileSync(file, 'utf8')

    for (const table of source.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\s*\);/g)) {
      const columns = table[2].split('\n')
        .map(line => /^\s*(\w+)\s+TEXT\s+PRIMARY KEY\s*,?\s*$/.exec(line)?.[1])
        .filter(Boolean)

      if (columns.length) needs.set(table[1], columns)
    }
  }

  return needs
}

function* walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name).split(path.sep).join('/')
    if (entry.isDirectory()) yield* walk(file)
    else if (entry.name.endsWith('.ts')) yield file
  }
}

// Counts top-level commas, so JSON.stringify({ a, b }) stays one argument.
function countArguments(body) {
  let depth = 0
  let count = 1
  let quote = ''

  for (let i = 0; i < body.length; i++) {
    const ch = body[i]

    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = ''
      continue
    }

    if (ch === '/' && body[i + 1] === '/') i = body.indexOf('\n', i)
    else if (ch === '"' || ch === "'" || ch === '`') quote = ch
    else if ('([{'.includes(ch)) depth++
    else if (')]}'.includes(ch)) depth--
    else if (ch === ',' && depth === 0) count++

    if (i < 0) break
  }

  return body.trim() ? (body.trim().endsWith(',') ? count - 1 : count) : 0
}

// The array literal passed as the very next argument, balanced by depth. Only
// whitespace and the separating comma may sit between it and the statement.
function argumentsAfter(source, from) {
  const open = source.indexOf('[', from)
  if (open < 0 || /[^\s,]/.test(source.slice(from, open))) return null

  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '[') depth++
    else if (source[i] === ']') {
      depth--
      if (!depth) return source.slice(open + 1, i)
    }
  }

  return null
}

const needsKey = generatedKeys()
const problems = []
let checked = 0

for (const file of walk('server')) {
  const source = fs.readFileSync(file, 'utf8')
  const at = index => `${file}:${source.slice(0, index).split('\n').length}`

  // Every INSERT: its table and the columns it names.
  for (const insert of source.matchAll(/INSERT INTO\s+(\w+)\s*\(([^)]*)\)/g)) {
    const columns = insert[2].split(',').map(column => column.trim())

    for (const key of needsKey.get(insert[1]) ?? []) {
      if (!columns.includes(key)) {
        problems.push(`${at(insert.index)} — INSERT INTO ${insert[1]} does not set \`${key}\`, `
          + 'which the table has no default for')
      }
    }
  }

  // Every parameterised statement, against the values handed to it.
  for (const match of source.matchAll(/`(\s*(?:INSERT|UPDATE|DELETE|SELECT|WITH)\b[^`]*)`/gi)) {
    const placeholders = [...match[1].matchAll(/\$(\d+)/g)].map(m => Number(m[1]))
    if (!placeholders.length) continue

    const args = argumentsAfter(source, match.index + match[0].length)
    if (args === null) continue

    checked++
    const passed = countArguments(args)
    const highest = Math.max(...placeholders)

    if (passed !== highest) {
      problems.push(`${at(match.index)} — ${passed} parameters passed, `
        + `statement uses $1 to $${highest}`)
    }
  }
}

if (problems.length) {
  console.error(problems.join('\n'))
  console.error('\nA parameter the statement never names is a column somebody meant to write')
  console.error('and did not. Postgres rejects the whole statement for it.')
  process.exit(1)
}

console.log(`✓ ${checked} statements match the values they are given, and every INSERT`)
console.log('  sets the keys its table has no default for')
