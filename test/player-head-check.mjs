// node --experimental-strip-types test/player-head-check.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  HEAD_VERSIONS, HEAD_MODES, HEAD_TARGETS, MAX_STACK,
  clampAmount, uuidToIntArray, texturesJson, headCommand, headFileName
} from '../app/utils/playerHead.ts'
import { TOOLS } from '../app/utils/tools.ts'

const en = JSON.parse(readFileSync(new URL('../i18n/locales/en.json', import.meta.url), 'utf8'))
const pl = JSON.parse(readFileSync(new URL('../i18n/locales/pl.json', import.meta.url), 'utf8'))

const NOTCH = '069a79f444e94726a5befca90e38aaf5'
const SKIN = 'https://textures.minecraft.net/texture/292009a4925b58f02c77dadc3ecef07ea4c7472f64e0fdc32ce5522489362680'

const opts = (over = {}) => ({
  version: 'modern',
  mode: 'name',
  name: 'Notch',
  uuid: NOTCH,
  textures: 'BASE64',
  target: '@p',
  amount: 1,
  ...over
})

// komenda po nicku w obu skladniach
{
  assert.equal(
    headCommand(opts()),
    '/give @p minecraft:player_head[profile="Notch"]'
  )
  assert.equal(
    headCommand(opts({ version: 'legacy' })),
    '/give @p minecraft:player_head{SkullOwner:"Notch"}'
  )
}

// ilosc dopisuje sie dopiero powyzej jednej sztuki
{
  assert.equal(headCommand(opts({ amount: 1 })).endsWith(']'), true, 'jedna sztuka bez liczby')
  assert.equal(headCommand(opts({ amount: 7 })).endsWith('] 7'), true)
  assert.equal(headCommand(opts({ version: 'legacy', amount: 64 })).endsWith('} 64'), true)

  assert.equal(clampAmount(0), 1, 'zero podciagamy do jednej')
  assert.equal(clampAmount(-5), 1)
  assert.equal(clampAmount(999), MAX_STACK, 'wiecej niz stack nie przejdzie')
  assert.equal(clampAmount(3.7), 3, 'ulamki obcinamy')
  assert.equal(clampAmount(Number.NaN), 1)
  assert.equal(MAX_STACK, 64)
}

// nick zawsze w cudzyslowie, inaczej parser wywala sie na nickach od cyfry
{
  for (const version of HEAD_VERSIONS) {
    const cmd = headCommand(opts({ version, name: '8Bit_Player' }))
    assert.ok(cmd.includes('"8Bit_Player"'), `${version}: nick musi byc w cudzyslowie`)
  }
}

// cel komendy
{
  assert.ok(headCommand(opts({ target: '@a' })).startsWith('/give @a '))
  assert.ok(headCommand(opts({ target: 'Steve' })).startsWith('/give Steve '))
  assert.ok(headCommand(opts({ target: '   ' })).startsWith('/give @p '), 'pusty cel wraca do @p')
  assert.ok(HEAD_TARGETS.includes('@p'))
}

// UUID w NBT to cztery inty ze znakiem
{
  const ints = uuidToIntArray(NOTCH)
  assert.equal(ints.length, 4)
  assert.equal(ints[0], 0x069a79f4 | 0)
  assert.equal(ints[1], 0x44e94726 | 0)
  assert.equal(ints[2], 0xa5befca9 | 0)
  assert.equal(ints[3], 0x0e38aaf5 | 0)
  assert.ok(ints[2] < 0, 'polowa uuid-ow ma bity znaku zapalone')

  // myslniki nie moga zmieniac wyniku
  assert.deepEqual(uuidToIntArray('069a79f4-44e9-4726-a5be-fca90e38aaf5'), ints)
  for (const n of ints) assert.ok(Number.isInteger(n) && n >= -2147483648 && n <= 2147483647)
}

// wariant z wklejona tekstura
{
  const modern = headCommand(opts({ mode: 'texture' }))
  assert.equal(
    modern,
    '/give @p minecraft:player_head[profile={properties:[{name:"textures",value:"BASE64"}]}]'
  )

  const legacy = headCommand(opts({ mode: 'texture', version: 'legacy' }))
  assert.ok(legacy.includes('Id:[I;'), 'stare NBT potrzebuje tablicy intow')
  assert.ok(legacy.includes('Properties:{textures:[{Value:"BASE64"}]}'))
  assert.ok(legacy.includes(uuidToIntArray(NOTCH).join(',')))

  // wariant tekstury nie moze przemycac nicku
  assert.ok(!modern.includes('Notch'))
  assert.ok(!legacy.includes('Notch'))
}

// base64 niesie JSON z adresem tekstury, a nie sama teksture
{
  const json = texturesJson(SKIN)
  const parsed = JSON.parse(json)
  assert.equal(parsed.textures.SKIN.url, SKIN)
  assert.ok(!json.includes('data:'), 'to ma byc adres, nie zawartosc')

  // to, co realnie ladowaloby w komendzie, musi sie odkodowac z powrotem
  const encoded = Buffer.from(json).toString('base64')
  assert.deepEqual(JSON.parse(Buffer.from(encoded, 'base64').toString()), parsed)
  assert.ok(headCommand(opts({ mode: 'texture', textures: encoded })).includes(encoded))
}

// nazwa pliku nie przemyci sciezki
{
  assert.equal(headFileName('Notch'), 'Notch-head.png')
  assert.equal(headFileName('../../etc'), 'etc-head.png')
  assert.equal(headFileName(''), 'player-head.png')
}

// kazdy wariant produkuje poprawnie domkniete nawiasy
{
  for (const version of HEAD_VERSIONS) {
    for (const mode of HEAD_MODES) {
      const cmd = headCommand(opts({ version, mode, amount: 12 }))
      for (const [open, close] of [['[', ']'], ['{', '}']]) {
        const a = cmd.split(open).length - 1
        const b = cmd.split(close).length - 1
        assert.equal(a, b, `${version}/${mode}: niedomkniete ${open}${close}`)
      }
      assert.ok(cmd.startsWith('/give '), `${version}/${mode}: zly poczatek`)
      assert.ok(cmd.includes('minecraft:player_head'), `${version}/${mode}: brak przedmiotu`)
      assert.ok(cmd.endsWith(' 12'), `${version}/${mode}: brak ilosci`)
    }
  }
}

// narzedzie wlaczone i opisane w obu jezykach
{
  const tool = TOOLS.find(t => t.id === 'player-head')
  assert.ok(tool && tool.live === true, 'narzedzie ma byc live')
  assert.equal(tool.cat, 'skin')

  for (const [loc, dict] of [['en', en], ['pl', pl]]) {
    const h = dict.playerHead
    assert.ok(h, `${loc}: brak sekcji playerHead`)
    assert.ok(dict.tools['player-head'], `${loc}: brak opisu na kafelku`)
    for (const v of HEAD_VERSIONS) {
      assert.ok(h.versions[v], `${loc}: brak nazwy skladni ${v}`)
      assert.ok(h.versionRange[v], `${loc}: brak zakresu wersji ${v}`)
    }
    for (const m of HEAD_MODES) {
      assert.ok(h.modes[m], `${loc}: brak nazwy trybu ${m}`)
      assert.ok(h.modeHint[m], `${loc}: brak podpowiedzi trybu ${m}`)
    }
    assert.equal(h.features.length, 3, `${loc}: features`)
    assert.ok(h.faq.length >= 5, `${loc}: za malo pytan`)
  }

  assert.match(en.playerHead.versionRange.modern, /1\.20\.5/)
  assert.match(en.playerHead.versionRange.legacy, /1\.13/)
}

console.log('player-head: ok')
