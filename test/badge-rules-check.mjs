// node --experimental-strip-types test/badge-rules-check.mjs
//
// Kazda regula odznaki to fragment SQL. Literowka w nim nie wywroci buildu ani
// startu — wyjdzie dopiero przy zapisie odznaki, u zywego uzytkownika. Ten
// sprawdzian planuje kazde zapytanie w bazie (EXPLAIN, bez zapisu).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BADGE_RULES, badgeRule, ruleQuery } from '../server/utils/badges.ts'

const ids = BADGE_RULES.map(r => r.id)
assert.equal(new Set(ids).size, ids.length, 'powtorzony identyfikator reguly')
assert.ok(badgeRule('manual') && !badgeRule('nie-ma-takiej'))

for (const rule of BADGE_RULES) {
  assert.ok(['none', 'number', 'date', 'text'].includes(rule.param), `${rule.id}: zly typ wartosci`)
  assert.ok(rule.label && rule.hint, `${rule.id}: brak opisu`)

  if (!rule.where) {
    assert.ok(['manual', 'code'].includes(rule.id), `${rule.id}: regula bez warunku`)
    continue
  }

  assert.notEqual(rule.param, 'none', `${rule.id}: warunek bez wartosci`)
  assert.match(rule.where, /\$3/, `${rule.id}: warunek nie uzywa $3`)
  assert.doesNotMatch(rule.where, /\$4/, `${rule.id}: $4 jest zarezerwowane na filtr konta`)
  assert.doesNotMatch(rule.where, /\$[125]/, `${rule.id}: warunek siega po cudzy parametr`)
}

const withWhere = BADGE_RULES.filter(r => r.where)
assert.ok(withWhere.length >= 10, 'regul automatycznych ma byc kilkanascie')
console.log(`reguly: ${BADGE_RULES.length}, w tym automatycznych ${withWhere.length}`)

const url = (readFileSync(new URL('../.env', import.meta.url), 'utf8').match(/^DATABASE_URL=(.*)$/m) ?? [])[1]
if (!url) {
  console.log('brak DATABASE_URL — pomijam sprawdzenie SQL w bazie')
  process.exit(0)
}

const { default: pg } = await import('pg')
const pool = new pg.Pool({ connectionString: url.trim() })

const sample = { number: '3', date: '2026-12-24', text: 'abc' }

for (const rule of withWhere) {
  for (const forOneUser of [false, true]) {
    const params = ['test-slug', Date.now(), sample[rule.param]]
    if (forOneUser) params.push('test-user')

    await pool.query({ text: `EXPLAIN ${ruleQuery(rule.where, forOneUser)}`, values: params })
  }
  console.log(`  ${rule.id} ok`)
}

await pool.end()
console.log('kazda regula planuje sie w bazie')
