// node --experimental-strip-types test/small-text-check.mjs
import assert from 'node:assert/strict'
import { SMALL_CAPS, toSmallCaps, fromSmallCaps } from '../app/utils/smallText.ts'

assert.equal(SMALL_CAPS.length, 26, 'caly alfabet')
assert.equal(new Set(SMALL_CAPS.map(c => c.small)).size, 26, 'zadnych duplikatow')

assert.equal(toSmallCaps('Spectra'), 'ѕᴘᴇᴄᴛʀᴀ')
assert.equal(toSmallCaps('test'), 'ᴛᴇѕᴛ')
assert.equal(toSmallCaps('TEST'), 'ᴛᴇѕᴛ', 'wielkosc liter bez znaczenia')

// znaki spoza A-Z nietkniete — inaczej rozwaliloby to kody kolorow i nicki
assert.equal(toSmallCaps('§a1.21_x!'), '§ᴀ1.21_x!')
// polskie litery: baza dostaje kapitalik, ogonek zostaje doklejony
assert.equal(toSmallCaps('ł'), 'ᴌ', 'L z kreska ma wlasny kapitalik')
assert.equal(toSmallCaps('ą').normalize('NFC'), 'ᴀ̨', 'ogonek zachowany')
assert.equal(toSmallCaps('zażółć', true), 'ᴢᴀᴢᴏᴌᴄ', 'tryb bez znakow diakrytycznych')
assert.ok(!/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(toSmallCaps('zażółć gęślą', true).replace(/x/g, '')),
  'zadnych zwyklych liter po konwersji')
assert.equal(toSmallCaps(''), '')

// konwersja w druga strone wraca do punktu wyjscia
for (const word of ['spectra', 'minecraft', 'quixotic', 'fussy']) {
  assert.equal(fromSmallCaps(toSmallCaps(word)), word, word)
}

// X nie ma kapitalika, wiec zostaje soba — i to jest swiadome
assert.equal(toSmallCaps('X'), 'x')
assert.equal(SMALL_CAPS.filter(c => !c.exact).map(c => c.letter).join(''), 'FQSX')

console.log('ok — small text')
