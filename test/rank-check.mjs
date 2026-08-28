// node --experimental-strip-types test/rank-check.mjs
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import {
  RANK_STYLES, STYLE_SPECS, RANK_ICONS, ICON_PALETTE, RANK_PRESETS, ICON_MODES,
  iconById, tagLayout, shadowFallback, defaultRankTag, applyPreset, MAX_LABEL
} from '../app/utils/rankTag.ts'
import { TOOLS } from '../app/utils/tools.ts'

const en = JSON.parse(readFileSync(new URL('../i18n/locales/en.json', import.meta.url), 'utf8'))
const pl = JSON.parse(readFileSync(new URL('../i18n/locales/pl.json', import.meta.url), 'utf8'))

const base = (over = {}) => ({
  textWidth: 30,
  glyphHeight: 7,
  iconSize: 7,
  hasIcon: true,
  iconMode: 'joined',
  iconGap: 2,
  compactIconPad: false,
  padX: 2,
  padY: 1,
  border: 1,
  shadow: 1,
  ...over
})

// ikony sa siatka 7x7 i uzywaja wylacznie kolorow z palety
{
  const ids = RANK_ICONS.map(i => i.id)
  assert.equal(new Set(ids).size, ids.length, 'zdublowana ikona')

  for (const icon of RANK_ICONS) {
    assert.equal(icon.rows.length, 7, `${icon.id}: zla liczba wierszy`)
    let filled = 0
    for (const row of icon.rows) {
      assert.equal(row.length, 7, `${icon.id}: wiersz "${row}" nie ma 7 znakow`)
      for (const ch of row) {
        if (ch === '.') continue
        assert.ok(ICON_PALETTE[ch], `${icon.id}: znak "${ch}" spoza palety`)
        filled++
      }
    }
    assert.ok(filled >= 8, `${icon.id}: prawie pusta ikona`)
  }

  assert.equal(iconById('crown').rows.length, 7)
  assert.equal(iconById('nope'), undefined)
}

// kazdy styl trzyma sie siatki 5x7 przez calkowite skalowanie
{
  for (const id of RANK_STYLES) {
    const spec = STYLE_SPECS[id]
    assert.equal(spec.id, id, `${id}: niezgodne id stylu`)
    assert.ok(Number.isInteger(spec.scale) && spec.scale >= 1, `${id}: skala musi byc calkowita`)
    assert.ok(spec.spacing >= -1, `${id}: za ciasny odstep`)
    assert.ok(spec.outline >= 0, `${id}: ujemny obrys`)
  }
  assert.equal(STYLE_SPECS.big.scale, 2)
  assert.equal(STYLE_SPECS.compact.spacing, -1)
  assert.equal(STYLE_SPECS.bold.bold, true)
  assert.equal(STYLE_SPECS.outline.outline, 1)
}

// uklad polaczony: jedna wyspa, ikona przed tekstem
{
  const l = tagLayout(base())
  assert.equal(l.islands.length, 1)
  assert.equal(l.height, 7 + 1 + 2 * 1 + 2 * 1, 'wysokosc = glif + cien + padY*2 + border*2')
  assert.equal(l.islands[0].x, 1)
  assert.equal(l.islands[0].y, 1)
  assert.equal(l.width, l.islands[0].w + 2, 'obramowanie po obu stronach')
  assert.ok(l.icon.x < l.text.x, 'ikona ma byc przed tekstem')
  assert.equal(l.text.x, l.icon.x + 7 + 2)
}

// uklad rozdzielony: dwie wyspy i przezroczysta przerwa
{
  const joined = tagLayout(base())
  const split = tagLayout(base({ iconMode: 'separate' }))

  assert.equal(split.islands.length, 2)
  assert.ok(split.width > joined.width, 'rozdzielony ma byc szerszy o przerwe i obramowania')

  const [a, b] = split.islands
  const gap = b.x - (a.x + a.w)
  assert.equal(gap, 1 + 2 + 1, 'przerwa = border + iconGap + border')
  assert.equal(split.height, joined.height, 'obie wyspy maja te sama wysokosc')
  assert.ok(split.icon.x + split.icon.w <= a.x + a.w, 'ikona musi miescic sie w swojej wyspie')
  assert.ok(split.text.x >= b.x, 'tekst musi zaczynac sie w drugiej wyspie')
}

// ciasny margines zweza wyspe z ikona
{
  const wide = tagLayout(base({ iconMode: 'separate', padX: 4 }))
  const tight = tagLayout(base({ iconMode: 'separate', padX: 4, compactIconPad: true }))
  assert.ok(tight.islands[0].w < wide.islands[0].w, 'ciasny margines ma zwezac wyspe')
  assert.equal(tight.islands[0].w, 7 + 2)
}

// bez ikony zostaje sam tekst
{
  const l = tagLayout(base({ hasIcon: false }))
  assert.equal(l.islands.length, 1)
  assert.equal(l.icon, undefined)
  assert.equal(l.text.x, 1 + 2)
  assert.equal(l.width, 30 + 1 + 2 * 2 + 2 * 1)
}

// brak obramowania nie zostawia marginesu
{
  const l = tagLayout(base({ border: 0 }))
  assert.equal(l.islands[0].x, 0)
  assert.equal(l.islands[0].y, 0)
  assert.equal(l.width, l.islands[0].w)
  assert.equal(l.height, l.islands[0].h)
}

// wysokosc rosnie, gdy ikona jest wyzsza od tekstu
{
  const l = tagLayout(base({ iconSize: 14, glyphHeight: 7, shadow: 0 }))
  assert.equal(l.islands[0].h, 14 + 2)
  assert.ok(l.text.y > l.icon.y, 'nizszy tekst ma byc wysrodkowany')
}

// nic nie wychodzi poza plotno
{
  for (const mode of ICON_MODES) {
    for (const border of [0, 1, 4]) {
      for (const shadow of [0, 3]) {
        const l = tagLayout(base({ iconMode: mode, border, shadow }))
        for (const island of l.islands) {
          assert.ok(island.x - border >= 0, `${mode}/${border}: wyspa poza lewa krawedzia`)
          assert.ok(island.x + island.w + border <= l.width, `${mode}/${border}: wyspa poza prawa krawedzia`)
          assert.ok(island.y - border >= 0 && island.y + island.h + border <= l.height, `${mode}/${border}: wyspa poza pionem`)
        }
        assert.ok(l.text.y + 7 + shadow <= l.height, `${mode}/${shadow}: tekst poza dolem`)
      }
    }
  }
}

// nizsze pasmo tekstu ma isc w dol pasma, nie w gore — wolny piksel zostaje nad tekstem
{
  const l = tagLayout(base({ glyphHeight: 5, iconSize: 7, shadow: 1 }))
  const contentTop = 1 + 1
  const contentBottom = contentTop + 7
  assert.equal(l.text.y, contentTop + 1, 'tekst 6px w pasmie 7px ma byc przesuniety o piksel w dol')
  assert.equal(l.text.y + 5 + 1, contentBottom, 'dol tekstu z cieniem ma sie równac z dolem ikony')
  assert.equal(l.icon.y, contentTop)
}

// cien to kolor tekstu przyciemniony do jednej czwartej, jak w grze
{
  assert.equal(shadowFallback('#FFFFFF'), '#3F3F3F')
  assert.equal(shadowFallback('#FF5555'), '#3F1515')
  assert.equal(shadowFallback('#000000'), '#000000')
}

// gotowce sa kompletne i nie wychodza poza limit etykiety
{
  const keys = RANK_PRESETS.map(p => p.key)
  assert.deepEqual(keys, ['owner', 'admin', 'partner', 'mvip', 'mod', 'helper', 'vip', 'void', 'player'])
  assert.equal(new Set(keys).size, keys.length)

  for (const preset of RANK_PRESETS) {
    const state = applyPreset(preset)
    assert.ok(state.label.length > 0 && state.label.length <= MAX_LABEL, `${preset.key}: zla dlugosc etykiety`)
    assert.ok(iconById(state.icon), `${preset.key}: nieznana ikona ${state.icon}`)
    assert.ok(RANK_STYLES.includes(state.style), `${preset.key}: nieznany styl`)
    for (const hex of [state.bgStart, state.bgEnd, state.borderColor, state.textColor]) {
      assert.match(hex, /^#[0-9A-Fa-f]{6}$/, `${preset.key}: zly kolor ${hex}`)
    }
    assert.deepEqual(Object.keys(defaultRankTag()).sort(), Object.keys(state).sort(), `${preset.key}: niepelny stan`)
  }
}

// narzedzie jest zarejestrowane razem z grafika karty
{
  const tool = TOOLS.find(t => t.id === 'rank')
  assert.ok(tool, 'brak wpisu w TOOLS')
  assert.equal(tool.cat, 'srv')
  assert.equal(tool.live, true)
  assert.ok(existsSync(new URL('../public' + tool.bg, import.meta.url)), `brak grafiki ${tool.bg}`)

  const svg = readFileSync(new URL('../public' + tool.bg, import.meta.url), 'utf8')
  assert.ok(svg.includes('shape-rendering="crispEdges"'), 'grafika ma byc pixel art')
  assert.ok(svg.includes('prefers-reduced-motion'), 'animacja musi dac sie wylaczyc')
}

// tlumaczenia pokrywaja wszystko, co rysuje strona
{
  for (const [loc, dict] of [['en', en], ['pl', pl]]) {
    const r = dict.rank
    assert.ok(r, `${loc}: brak sekcji rank`)
    assert.ok(dict.tools.rank, `${loc}: brak opisu na kafelku`)

    for (const id of RANK_STYLES) {
      assert.ok(r.styles[id], `${loc}: brak nazwy stylu ${id}`)
      assert.ok(r.styleDesc[id], `${loc}: brak opisu stylu ${id}`)
    }
    for (const icon of RANK_ICONS) assert.ok(r.iconNames[icon.id], `${loc}: brak nazwy ikony ${icon.id}`)
    for (const mode of ICON_MODES) {
      assert.ok(r.iconModes[mode], `${loc}: brak nazwy trybu ${mode}`)
      assert.ok(r.iconModeHint[mode], `${loc}: brak podpowiedzi trybu ${mode}`)
    }
    for (const preset of RANK_PRESETS) assert.ok(r.presetNames[preset.key], `${loc}: brak nazwy gotowca ${preset.key}`)
    assert.equal(r.features.length, 3, `${loc}: features`)
    assert.ok(r.faq.length >= 5, `${loc}: za malo pytan`)
  }
}

console.log('rank: ok')
