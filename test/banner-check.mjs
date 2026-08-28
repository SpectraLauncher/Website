// node --experimental-strip-types test/banner-check.mjs
import assert from 'node:assert/strict'
import { BANNER_PATTERNS, BANNER_COLORS, BANNER_W, BANNER_H, maskAt, patternById } from '../app/utils/bannerPatterns.ts'
import { bannerGive, legacyColorId, BANNER_PRESETS } from '../app/utils/bannerCommand.ts'

assert.equal(BANNER_COLORS.length, 16, '16 barwnikow')
assert.equal(new Set(BANNER_PATTERNS.map(p => p.id)).size, BANNER_PATTERNS.length, 'unikalne id')
assert.equal(new Set(BANNER_PATTERNS.map(p => p.legacy)).size, BANNER_PATTERNS.length, 'unikalne kody legacy')

// maska: 40 wierszy po 5 znakow hex
for (const p of BANNER_PATTERNS) {
  assert.equal(p.mask.length, BANNER_H * 5, `dlugosc maski ${p.id}`)
  assert.ok(/^[0-9a-f]+$/.test(p.mask), `hex ${p.id}`)
}

// base wypelnia wszystko, kazdy inny wzor cos zostawia
{
  const base = patternById('base')
  let all = true
  for (let y = 0; y < BANNER_H; y++) for (let x = 0; x < BANNER_W; x++) if (!maskAt(base.mask, x, y)) all = false
  assert.ok(all, 'base pokrywa caly baner')
}

// polowki sa rozlaczne i razem daja calosc
{
  const l = patternById('half_vertical').mask
  const r = patternById('half_vertical_right').mask
  for (let y = 0; y < BANNER_H; y++) {
    for (let x = 0; x < BANNER_W; x++) {
      assert.notEqual(maskAt(l, x, y), maskAt(r, x, y), `polowki pokrywaja sie na ${x},${y}`)
    }
  }
}

// numeryczne id kolorow ze starego NBT
assert.equal(legacyColorId('white'), 0)
assert.equal(legacyColorId('black'), 15)
assert.equal(legacyColorId('red'), 14)

// komendy — nowy format komponentowy
assert.equal(
  bannerGive('white', [{ pattern: 'stripe_bottom', color: 'red' }], 'banner', 'modern'),
  '/give @p white_banner[banner_patterns=[{pattern:"stripe_bottom",color:"red"}]]'
)
assert.equal(
  bannerGive('blue', [], 'banner', 'modern'),
  '/give @p blue_banner',
  'bez warstw nie ma pustego komponentu'
)
assert.equal(
  bannerGive('red', [{ pattern: 'creeper', color: 'lime' }], 'shield', 'modern'),
  '/give @p shield[base_color="red",banner_patterns=[{pattern:"creeper",color:"lime"}]]'
)

// stary format NBT z kodami skroconymi i numerami kolorow
assert.equal(
  bannerGive('white', [{ pattern: 'stripe_bottom', color: 'red' }], 'banner', 'legacy'),
  '/give @p white_banner{BlockEntityTag:{Patterns:[{Pattern:"bs",Color:14}]}} 1'
)
assert.equal(
  bannerGive('black', [{ pattern: 'creeper', color: 'lime' }], 'shield', 'legacy'),
  '/give @p shield{BlockEntityTag:{Base:15,Patterns:[{Pattern:"cre",Color:5}]}} 1'
)

// presety uzywaja wylacznie istniejacych wzorow i kolorow
const colorIds = new Set(BANNER_COLORS.map(c => c.id))
for (const preset of BANNER_PRESETS) {
  assert.ok(colorIds.has(preset.base), `${preset.key}: kolor bazowy`)
  for (const layer of preset.layers) {
    assert.ok(patternById(layer.pattern), `${preset.key}: wzor ${layer.pattern}`)
    assert.ok(colorIds.has(layer.color), `${preset.key}: kolor ${layer.color}`)
  }
}

console.log(`ok — banner (${BANNER_PATTERNS.length} wzorow, ${BANNER_PRESETS.length} presetow)`)
