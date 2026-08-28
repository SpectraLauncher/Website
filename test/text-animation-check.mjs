// node --experimental-strip-types test/text-animation-check.mjs
import assert from 'node:assert/strict'
import {
  colorSequence, buildFrames, frameToText, frameCount, renderTemplate, DEFAULT_TEMPLATE
} from '../app/utils/textAnimation.ts'

const stops = ['#C4F454', '#A554B6']
const opts = (over = {}) => ({ text: 'Spectra', stops, style: 'bounce', format: 'amp_hex', ...over })

// rampa jest zawsze odbita, niezaleznie od stylu: 7 znakow daje 12 pozycji
assert.equal(colorSequence(stops, 7).length, 12)
assert.equal(frameCount(opts({ style: 'left' })), 12)
assert.equal(frameCount(opts({ style: 'right' })), 12)
assert.equal(frameCount(opts({ style: 'cycle' })), 12)
// bounce dokleja powrot bez powtarzania skrajnych klatek
assert.equal(frameCount(opts({ style: 'bounce' })), 22)

// petla domyka sie plynnie — koniec sekwencji sasiaduje z jej poczatkiem
{
  const seq = colorSequence(stops, 7)
  assert.notEqual(seq[0], seq[seq.length - 1], 'koncowka nie moze duplikowac poczatku')
  assert.equal(seq[1], seq[seq.length - 1], 'odbicie musi wracac po sasiedzie')
}

// left: kolejna klatka to ten sam wzor przesuniety o jedna pozycje w prawo
{
  const f = buildFrames(opts({ style: 'left' }))
  for (let k = 0; k < f.length - 1; k++) {
    assert.equal(f[k + 1].chars[1].hex, f[k].chars[0].hex, `przesuniecie miedzy ${k} a ${k + 1}`)
  }
  // ostatnia klatka przechodzi w pierwsza bez skoku
  assert.equal(f[0].chars[1].hex, f.at(-1).chars[0].hex, 'petla musi sie domykac')
}

// right to lustro left
{
  const l = buildFrames(opts({ style: 'left' }))
  const r = buildFrames(opts({ style: 'right' }))
  for (let k = 1; k < l.length; k++) {
    assert.equal(r[k].chars[0].hex, l[l.length - k].chars[0].hex, `lustro na klatce ${k}`)
  }
}

// bounce: druga polowa to pierwsza odtworzona wstecz
{
  const b = buildFrames(opts({ style: 'bounce' }))
  const f = buildFrames(opts({ style: 'left' }))
  assert.equal(b.length, 2 * f.length - 2)
  for (let k = 0; k < f.length; k++) {
    assert.deepEqual(b[k], f[k], `klatka w przod ${k}`)
  }
  assert.deepEqual(b[f.length], f[f.length - 2], 'powrot startuje od przedostatniej')
  assert.deepEqual(b.at(-1), f[1], 'powrot konczy sie na drugiej')
}

// cycle tez domyka petle
{
  const f = buildFrames(opts({ style: 'cycle' }))
  const colors = f.map(x => x.chars[0].hex)
  // odbicie z definicji powtarza barwy, wiec liczy sie sasiedztwo, nie unikalnosc
  assert.deepEqual(colors, colorSequence(stops, 7), 'cykl idzie po calej odbitej rampie')
  assert.notEqual(colors[0], colors.at(-1), 'ostatnia klatka nie duplikuje pierwszej')
  assert.equal(colors.at(-1), colors[1], 'powrot wchodzi przez sasiada, bez skoku')
  for (const frame of f) {
    assert.equal(new Set(frame.chars.filter(c => c.hex).map(c => c.hex)).size, 1,
      'w cyklu wszystkie znaki maja ten sam kolor')
  }
}

// spacje nie dostaja koloru i nie zajmuja miejsca w rampie
{
  const f = buildFrames(opts({ text: 'a b' }))
  assert.equal(f[0].chars[1].hex, '')
  assert.equal(f[0].chars.length, 3)
}
assert.deepEqual(buildFrames(opts({ text: '   ' })), [])

// formaty wyjscia
{
  const frame = buildFrames(opts({ text: 'A' }))[0]
  const hex = frame.chars[0].hex.toLowerCase()
  const digits = hex.slice(1)

  assert.equal(frameToText(frame, 'amp_hex'), `&${hex}A`)
  assert.equal(frameToText(frame, 'angle_hex'), `<${hex}>A`)
  assert.equal(frameToText(frame, 'minimessage'), `<color:${hex}>A`)
  assert.equal(frameToText(frame, 'bbcode'), `[COLOR=${hex}]A[/COLOR]`)
  assert.equal(frameToText(frame, 'section_x'), '§x' + [...digits].map(d => '§' + d).join('') + 'A')
  assert.equal(frameToText(frame, 'amp_x'), '&x' + [...digits].map(d => '&' + d).join('') + 'A')
  assert.deepEqual(JSON.parse(frameToText(frame, 'json')), [{ text: 'A', color: hex }])
}

// formatowanie: w zapisach legacy kody musza powtarzac sie przy kazdym znaku,
// bo kod koloru je kasuje; w tagowych wystarczy owinac calosc raz
{
  const f = buildFrames(opts({ text: 'Ab', style: 'left' }))[0]
  const flags = { bold: true, italic: true }

  const amp = frameToText(f, 'amp_hex', flags)
  assert.equal((amp.match(/&l/g) || []).length, 2, 'kod pogrubienia przy kazdym znaku')
  assert.ok(amp.indexOf('&l') > amp.indexOf('&#'), 'format musi isc po kolorze')

  const sec = frameToText(f, 'section_x', flags)
  assert.equal((sec.match(/§l/g) || []).length, 2)

  const mini = frameToText(f, 'minimessage', flags)
  assert.equal((mini.match(/<bold>/g) || []).length, 1, 'tag otwierany raz')
  assert.ok(mini.startsWith('<bold><italic>') && mini.endsWith('</italic></bold>'), 'tagi zamykane odwrotnie')

  const bb = frameToText(f, 'bbcode', flags)
  assert.ok(bb.startsWith('[B][I]') && bb.endsWith('[/I][/B]'))

  const json = JSON.parse(frameToText(f, 'json', flags))
  assert.equal(json[0].bold, true)
  assert.equal(json[1].italic, true)

  // bez flag nic sie nie dokleja
  assert.equal(frameToText(f, 'amp_hex'), frameToText(f, 'amp_hex', {}))
  assert.ok(!frameToText(f, 'minimessage').includes('<bold>'))
}

// szablon
{
  const out = renderTemplate(DEFAULT_TEMPLATE, ['aaa', 'bbb'], 'logo', 50)
  assert.equal(out, 'logo:\n  change-interval: 50\n  texts:\n  - "aaa"\n  - "bbb"')
}
{
  // wlasny szablon: $t wielokrotnie i tekst dookola
  const out = renderTemplate('x%output:{[$t] <$t>}%y', ['1', '2'], 'n', 1)
  assert.equal(out, 'x[1] <1>\n[2] <2>y')
}
assert.equal(renderTemplate('%name% %speed%', [], 'a', 7), 'a 7')

console.log('ok — text animation')
