// node --experimental-strip-types test/motd-check.mjs
import assert from 'node:assert/strict'
import { motdRaw, motdProperties, visibleLength, isOverflowing, parseMotd, MOTD_LINE_LENGTH } from '../app/utils/motd.ts'
import { MC_COLORS } from '../app/utils/mcColors.ts'

const c = code => MC_COLORS.find(x => x.code === code)

// dwie linie lacza sie znakiem nowej linii
{
  const raw = motdRaw([
    [{ text: 'Spectra', color: c('6'), bold: true }],
    [{ text: 'open beta', color: c('7') }]
  ])
  assert.equal(raw, '§6§lSpectra\n§7open beta')
}

// trzecia linia jest odcinana — vanilla i tak jej nie pokaze
assert.equal(motdRaw([[{ text: 'a' }], [{ text: 'b' }], [{ text: 'c' }]]), 'a\nb')

// server.properties: § jako §, lamanie jako \n
{
  const props = motdProperties('§6§lSpectra\n§7beta')
  assert.equal(props, String.raw`\u00A76\u00A7lSpectra\n\u00A77beta`)
  assert.ok(!props.includes('§'), 'zaden surowy paragraf nie moze zostac')
  assert.ok(!props.includes('\n'), 'zadne prawdziwe lamanie linii')
}

// dlugosc liczy tylko widoczne znaki
{
  const runs = [{ text: 'Spec', color: c('6'), bold: true }, { text: 'tra' }]
  assert.equal(visibleLength(runs), 7, 'kody nie licza sie do dlugosci')
  assert.ok(!isOverflowing(runs))
  assert.ok(isOverflowing([{ text: 'x'.repeat(MOTD_LINE_LENGTH + 1) }]))
}

// parsowanie z powrotem
{
  const lines = parseMotd('§6§lSpectra\n§7open beta')
  assert.equal(lines.length, 2)
  assert.equal(lines[0][0].text, 'Spectra')
  assert.equal(lines[0][0].color.code, '6')
  assert.equal(lines[0][0].bold, true)
  assert.equal(lines[1][0].color.code, '7')
}

// kolor kasuje formatowanie — po §a pogrubienie nie moze przetrwac
{
  const lines = parseMotd('§lbold§ared')
  assert.equal(lines[0][0].bold, true)
  assert.equal(lines[0][1].text, 'red')
  assert.ok(!lines[0][1].bold, 'kolor musi wyczyscic pogrubienie')
}

// & tez jest akceptowane na wejsciu, a \n w postaci tekstowej dzieli linie
{
  assert.equal(parseMotd('&cred')[0][0].color.code, 'c')
  assert.equal(parseMotd('a\nb').length, 2)
}

// pelny obieg: kody -> fragmenty -> kody
{
  const raw = '§6§lSpectra\n§7open beta'
  assert.equal(motdRaw(parseMotd(raw)), raw)
}

console.log('ok — motd')
