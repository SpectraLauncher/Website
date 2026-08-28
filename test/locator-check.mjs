// node --experimental-strip-types test/locator-check.mjs
import assert from 'node:assert/strict'
import {
  uuidHash, rawColor, setBrightness, locatorColor, locatorColorLegacy,
  rgbToHsb, hsbToRgb, isUuid, dashUuid
} from '../app/utils/locatorColor.ts'
import { toHex, toRgb } from '../app/utils/rgb.ts'

// Notch — wektor podawany przez inne kalkulatory tego samego algorytmu
const NOTCH = '069a79f4-44e9-4726-a5be-fca90e38aaf5'

assert.equal(uuidHash(NOTCH) >>> 0, 0xE9F5688E, 'UUID.hashCode')
assert.equal(toHex(rawColor(NOTCH)), '#F5688E', 'surowe RGB z dolnych 24 bitow')
assert.equal(toHex(locatorColorLegacy(NOTCH)), '#DC5D7F', '1.21.6: kanaly x0.9')

// HSV zachowuje odcien i nasycenie, wiec wynik rozni sie od mnozenia kanalow
assert.notEqual(toHex(locatorColor(NOTCH)), toHex(locatorColorLegacy(NOTCH)))

// jasnosc po normalizacji zawsze siada na 0.9 (max kanal = 229 lub 230)
for (const uuid of [
  NOTCH,
  '00000000-0000-0000-0000-000000000001',
  'f84c6a79-0a4e-45e0-879b-cd49ebd4c4e2',
  '853c80ef-3c37-49fd-aa49-938b674adae6'
]) {
  const { r, g, b } = toRgb(locatorColor(uuid))
  const max = Math.max(r, g, b)
  assert.ok(max === 229 || max === 230, `jasnosc 0.9 dla ${uuid}, max=${max}`)
}

// odcien i nasycenie przetrwaja normalizacje
{
  const raw = rawColor(NOTCH)
  const [h1, s1] = rgbToHsb(toRgb(raw))
  const [h2, s2] = rgbToHsb(toRgb(setBrightness(raw)))
  assert.ok(Math.abs(h1 - h2) < 0.01, 'odcien zachowany')
  assert.ok(Math.abs(s1 - s2) < 0.01, 'nasycenie zachowane')
}

// szarosc nie ma odcienia — osobna sciezka w HSBtoRGB
assert.equal(toHex(hsbToRgb(0, 0, 0.9)), '#E6E6E6', 'saturation 0')

// ten sam UUID zawsze ten sam kolor
assert.equal(locatorColor(NOTCH), locatorColor(dashUuid(NOTCH.replace(/-/g, ''))))

assert.ok(isUuid(NOTCH) && isUuid(NOTCH.replace(/-/g, '')))
assert.ok(!isUuid('Notch'))

console.log('ok — locator color')
