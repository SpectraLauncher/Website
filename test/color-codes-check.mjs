// node --experimental-strip-types test/color-codes-check.mjs
import assert from 'node:assert/strict'
import { MC_COLORS, runsToCodes } from '../app/utils/mcColors.ts'

const c = code => MC_COLORS.find(x => x.code === code)
const run = (text, extra = {}) => ({ text, ...extra })

const cases = [
  [
    'reset po kolorowym fragmencie',
    [[run('play ', { color: c('a') }), run('together')]],
    '§aplay §rtogether'
  ],
  [
    'kolor idzie przed formatem, bo sam kasuje formatowanie',
    [[run('hi', { color: c('c'), bold: true })]],
    '§c§lhi'
  ],
  [
    'reset po samym formacie, bez koloru',
    [[run('bold', { bold: true }), run(' plain')]],
    '§lbold§r plain'
  ],
  [
    'brak resetu, gdy nic wczesniej nie bylo aktywne',
    [[run('plain'), run(' more')]],
    'plain more'
  ],
  [
    'nowy kolor nie potrzebuje resetu',
    [[run('a', { color: c('a') }), run('b', { color: c('c') })]],
    '§aa§cb'
  ],
  [
    'format po resecie dostaje reset i wlasny kod',
    [[run('x', { color: c('e') }), run('y', { italic: true })]],
    '§ex§r§oy'
  ],
  [
    'kazda linia zaczyna sie od czystego stanu',
    [[run('a', { color: c('a') })], [run('b')]],
    '§aa\nb'
  ]
]

for (const [name, lines, expected] of cases) {
  assert.equal(runsToCodes(lines, '§'), expected, name)
}

// & to ten sam zapis, inny znak
assert.equal(
  runsToCodes([[run('play ', { color: c('a') }), run('together')]], '&'),
  '&aplay &rtogether'
)

console.log(`ok — ${cases.length + 1} przypadkow`)
