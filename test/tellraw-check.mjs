// node --experimental-strip-types test/tellraw-check.mjs
import assert from 'node:assert/strict'
import {
  emptySegment, segmentToJson, segmentsToJson, tellrawCommand, DEFAULT_TIMES
} from '../app/utils/tellraw.ts'

const seg = (over = {}) => ({ ...emptySegment('hi'), ...over })

// biel i wylaczone style nie trafiaja do JSON-a — to wartosci domyslne
assert.deepEqual(segmentToJson(seg(), 'modern'), { text: 'hi' })
assert.deepEqual(
  segmentToJson(seg({ color: 'red', bold: true }), 'modern'),
  { text: 'hi', color: 'red', bold: true }
)

// 1.21.5+: click_event z nazwanym polem zaleznym od akcji
assert.deepEqual(
  segmentToJson(seg({ clickAction: 'run_command', clickValue: '/spawn' }), 'modern').click_event,
  { action: 'run_command', command: '/spawn' }
)
assert.deepEqual(
  segmentToJson(seg({ clickAction: 'open_url', clickValue: 'https://x.dev' }), 'modern').click_event,
  { action: 'open_url', url: 'https://x.dev' }
)
assert.deepEqual(
  segmentToJson(seg({ clickAction: 'copy_to_clipboard', clickValue: 'abc' }), 'modern').click_event,
  { action: 'copy_to_clipboard', value: 'abc' }
)

// 1.13-1.21.4: clickEvent zawsze z polem value
assert.deepEqual(
  segmentToJson(seg({ clickAction: 'open_url', clickValue: 'https://x.dev' }), 'legacy').clickEvent,
  { action: 'open_url', value: 'https://x.dev' }
)

// hover: contents w starym formacie, value w nowym
assert.deepEqual(
  segmentToJson(seg({ hoverText: 'yo' }), 'modern').hover_event,
  { action: 'show_text', value: 'yo' }
)
assert.deepEqual(
  segmentToJson(seg({ hoverText: 'yo' }), 'legacy').hoverEvent,
  { action: 'show_text', contents: 'yo' }
)

// akcja bez wartosci nie generuje pustego eventu
assert.equal(segmentToJson(seg({ clickAction: 'run_command' }), 'modern').click_event, undefined)

// puste segmenty wypadaja
// pusty string na czele listy — inaczej styl pierwszego segmentu przecieka na reszte
assert.equal(segmentsToJson([seg(), emptySegment('')], 'modern'), '["",{"text":"hi"}]')
{
  const json = segmentsToJson([seg({ color: 'gold', bold: true }), seg({ text: 'plain' })], 'modern')
  assert.equal(JSON.parse(json)[0], '', 'rodzic musi byc pusty')
  assert.deepEqual(JSON.parse(json)[2], { text: 'plain' }, 'drugi segment bez odziedziczonych stylow')
}
assert.equal(tellrawCommand([emptySegment('')], 'chat', 'modern'), '', 'brak tekstu = brak komendy')

// komendy
assert.equal(
  tellrawCommand([seg()], 'chat', 'modern', '@p'),
  '/tellraw @p ["",{"text":"hi"}]'
)
assert.equal(
  tellrawCommand([seg()], 'title', 'modern', '@a'),
  '/title @a title ["",{"text":"hi"}]',
  'domyslne czasy nie generuja drugiej linii'
)
assert.equal(
  tellrawCommand([seg()], 'title', 'modern', '@a', { fadeIn: 5, stay: 40, fadeOut: 5 }),
  '/title @a times 5 40 5\n/title @a title ["",{"text":"hi"}]'
)
assert.equal(
  tellrawCommand([seg()], 'actionbar', 'modern', '@a', { fadeIn: 5, stay: 40, fadeOut: 5 }),
  '/title @a actionbar ["",{"text":"hi"}]',
  'actionbar ignoruje czasy'
)
assert.equal(DEFAULT_TIMES.stay, 70)

console.log('ok — tellraw')
