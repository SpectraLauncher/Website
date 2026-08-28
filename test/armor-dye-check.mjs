// node --experimental-strip-types test/armor-dye-check.mjs
import assert from 'node:assert/strict'
import {
  DYES, mixDyes, matchColor, dyeCommand, UNDYED
} from '../app/utils/armorDye.ts'
import { toHex, fromHex, toRgb } from '../app/utils/rgb.ts'

assert.equal(DYES.length, 16, '16 barwnikow')

// pojedynczy barwnik daje dokladnie swoj kolor — wzmocnienie wychodzi 1
for (const d of DYES) {
  assert.equal(toHex(mixDyes([d.id])), d.hex, `pojedynczy ${d.id}`)
}

// czerwony + niebieski: znany wynik z gry
assert.equal(toHex(mixDyes(['red', 'blue'])), '#AD5398')

// kolejnosc barwnikow nie zmienia wyniku
assert.equal(mixDyes(['red', 'blue', 'white']), mixDyes(['white', 'red', 'blue']))

// wzmocnienie faktycznie podbija szczyt: bez niego srednia byla ciemniejsza
{
  const mixed = toRgb(mixDyes(['red', 'blue']))
  const r = toRgb(fromHex('#B02E26'))
  const b = toRgb(fromHex('#3C44AA'))
  const plainAvgMax = Math.max((r.r + b.r) / 2, (r.g + b.g) / 2, (r.b + b.b) / 2)
  assert.ok(Math.max(mixed.r, mixed.g, mixed.b) > plainAvgMax, 'szczyt podbity przez wzmocnienie')
}

// juz pofarbowana zbroja liczy sie jako skladnik
assert.notEqual(mixDyes(['white'], UNDYED), mixDyes(['white']))
assert.equal(mixDyes([]), undefined, 'brak skladnikow = brak wyniku')

// ten sam barwnik dwa razy nie zmienia koloru
assert.equal(mixDyes(['lime', 'lime']), mixDyes(['lime']))

// dopasowanie koloru
{
  const target = fromHex('#B02E26')
  const m = matchColor(target, 3)
  assert.equal(m.distance, 0, 'kolor barwnika trafiony idealnie')
  assert.deepEqual(m.dyes, ['red'], 'i to jednym barwnikiem')
}
{
  // kolor spoza palety — wynik musi byc odtwarzalny tym samym zestawem
  const m = matchColor(fromHex('#7F6FA0'), 4)
  assert.ok(m.dyes.length >= 1 && m.dyes.length <= 4)
  assert.equal(mixDyes(m.dyes), m.color, 'zwrocony kolor zgadza sie z przemieszaniem zwroconych barwnikow')
}

// komendy
assert.equal(
  dyeCommand('chestplate', 11546150, false),
  '/give @p leather_chestplate[dyed_color=11546150]'
)
assert.equal(
  dyeCommand('boots', 11546150, true, '@a'),
  '/give @a leather_boots{display:{color:11546150}} 1'
)

console.log('ok — armor dye')
