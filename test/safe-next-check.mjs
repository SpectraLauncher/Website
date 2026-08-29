// node --experimental-strip-types test/safe-next-check.mjs
import assert from 'node:assert/strict'
import { safeNext } from '../app/utils/safeNext.ts'

const home = '/account'
const BACKSLASH = String.fromCharCode(92)
const NEWLINE = String.fromCharCode(10)

for (const ok of ['/account', '/pl/launcher/auth', '/tools/gradient?a=1', '/u/makotopd#stats']) {
  assert.equal(safeNext(ok, home), ok, `mial przejsc: ${ok}`)
}

for (const bad of [
  'https://zla-strona.example/',
  '//zla-strona.example/',
  '/' + BACKSLASH + 'zla-strona.example',
  BACKSLASH + BACKSLASH + 'zla-strona.example',
  'javascript:alert(1)',
  '/account' + NEWLINE + 'Set-Cookie: x=1',
  'account',
  '',
  undefined,
  null,
  123,
  ['/account'],
]) {
  assert.equal(safeNext(bad, home), home, `mial zostac odrzucony: ${JSON.stringify(bad)}`)
}

console.log('✓ przekierowanie po zalogowaniu przyjmuje wylacznie sciezki wewnetrzne')
