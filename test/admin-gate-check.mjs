import assert from 'node:assert/strict'
import { parseAdminEmails, isAdminEmail } from '../server/utils/admin.ts'

const fallback = parseAdminEmails('')
assert.deepEqual(fallback, ['patrydab4@gmail.com'], 'pusta zmienna ma dac wbudowana liste')

assert.ok(isAdminEmail('patrydab4@gmail.com', fallback))
assert.ok(isAdminEmail('  PatryDab4@Gmail.com  ', fallback), 'wielkosc liter i spacje nie moga blokowac')
assert.ok(!isAdminEmail('ktos@inny.pl', fallback))
assert.ok(!isAdminEmail('', fallback))
assert.ok(!isAdminEmail(null, fallback))
assert.ok(!isAdminEmail(undefined, fallback))

// podszycie sie pod adres z listy jako poddomena/prefiks nie moze przejsc
for (const near of [
  'patrydab4@gmail.com.evil.pl',
  'x+patrydab4@gmail.com',
  'patrydab4@gmail.co',
  'patrydab4@gmailxcom'
]) {
  assert.ok(!isAdminEmail(near, fallback), `podobny adres przeszedl: ${near}`)
}

const many = parseAdminEmails(' a@x.pl , B@Y.pl ,, ')
assert.deepEqual(many, ['a@x.pl', 'b@y.pl'], 'lista ma byc przycieta i male litery')
assert.ok(!isAdminEmail('patrydab4@gmail.com', many), 'jawna lista wypiera wbudowana')

console.log('admin-gate: ok')
