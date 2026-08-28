// node --experimental-strip-types test/gradient-check.mjs
import assert from 'node:assert/strict'
import { sample, mix, gradientChars, toGradientCode } from '../app/utils/gradient.ts'

// konce rampy trafiaja dokladnie w podane kolory
assert.equal(sample(['#FF0000', '#0000FF'], 0), '#FF0000')
assert.equal(sample(['#FF0000', '#0000FF'], 1), '#0000FF')
assert.equal(mix('#000000', '#FFFFFF', 0.5), '#808080')

// trzy przystanki: srodek rampy to dokladnie srodkowy kolor
assert.equal(sample(['#FF0000', '#00FF00', '#0000FF'], 0.5), '#00FF00')
assert.equal(sample(['#FF0000', '#00FF00', '#0000FF'], 0.25), '#808000')

// jeden przystanek = jednolity kolor, brak przystankow = biel
assert.equal(sample(['#123456'], 0.7), '#123456')
assert.equal(sample([], 0.5), '#FFFFFF')

// spacje bez koloru i bez miejsca w rampie
{
  const out = gradientChars('ab cd', ['#FF0000', '#0000FF'])
  assert.equal(out.length, 5)
  assert.equal(out[2].hex, '', 'spacja bez koloru')
  assert.equal(out[0].hex, '#FF0000', 'pierwszy widoczny znak = poczatek rampy')
  assert.equal(out[4].hex, '#0000FF', 'ostatni widoczny znak = koniec rampy')
}

// pojedynczy znak nie dzieli przez zero
assert.equal(gradientChars('x', ['#FF0000', '#0000FF'])[0].hex, '#FF0000')
assert.deepEqual(toGradientCode('', ['#FF0000'], 'amp'), '')

// MiniMessage: jeden tag na cala fraze, formaty w srodku
assert.equal(
  toGradientCode('hi', ['#FF0000', '#0000FF'], 'minimessage'),
  '<gradient:#ff0000:#0000ff>hi</gradient>'
)
assert.equal(
  toGradientCode('hi', ['#FF0000', '#0000FF'], 'minimessage', { bold: true, italic: true }),
  '<gradient:#ff0000:#0000ff><bold><italic>hi</italic></bold></gradient>'
)

// &-hex: kod na kazdy znak
assert.equal(toGradientCode('hi', ['#FF0000', '#0000FF'], 'amp'), '&#ff0000h&#0000ffi')
assert.equal(toGradientCode('a b', ['#FF0000', '#0000FF'], 'amp'), '&#ff0000a &#0000ffb')

// §x: kazda cyfra heksu poprzedzona §, formatowanie powtorzone po kolorze
assert.equal(toGradientCode('h', ['#FF0000'], 'section'), '§x§f§f§0§0§0§0h')
assert.equal(
  toGradientCode('h', ['#FF0000'], 'section', { bold: true }),
  '§x§f§f§0§0§0§0§lh',
  'format musi isc po kolorze, bo kolor go kasuje'
)

console.log('ok — gradient')
