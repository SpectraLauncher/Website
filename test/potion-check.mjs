// node --experimental-strip-types test/potion-check.mjs
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import {
  POTIONS, POTION_VARIANTS, POTION_ITEMS, potionByKey, potionCommand, formatDuration,
  itemDuration, roman, availableVariants, itemsFor, hasEffects, variantIngredient,
  potionTexture, ingredientTexture, INGREDIENTS
} from '../app/utils/potions.ts'

const en = JSON.parse(readFileSync(new URL('../i18n/locales/en.json', import.meta.url), 'utf8')).potion
const pl = JSON.parse(readFileSync(new URL('../i18n/locales/pl.json', import.meta.url), 'utf8')).potion

const byKey = k => potionByKey(k)

// kazda mikstura ma wariant podstawowy i unikalny klucz
{
  const keys = POTIONS.map(p => p.key)
  assert.equal(new Set(keys).size, keys.length, 'zdublowany klucz mikstury')

  for (const p of POTIONS) {
    assert.ok(p.forms.base, `${p.key} bez wariantu podstawowego`)
    assert.match(p.color, /^#[0-9A-F]{6}$/, `${p.key} ma zly kolor`)
    for (const v of POTION_VARIANTS) {
      const form = p.forms[v]
      if (!form) continue
      assert.match(form.id, /^[a-z_]+$/, `${p.key}/${v} ma zle id`)
    }
  }

  const ids = POTIONS.flatMap(p => POTION_VARIANTS.map(v => p.forms[v]?.id).filter(Boolean))
  assert.equal(new Set(ids).size, ids.length, 'zdublowane id mikstury')
}

// prefiksy long_/strong_ musza pasowac do wariantu
{
  for (const p of POTIONS) {
    if (p.forms.long) assert.ok(p.forms.long.id.startsWith('long_'), `${p.key} long`)
    if (p.forms.strong) assert.ok(p.forms.strong.id.startsWith('strong_'), `${p.key} strong`)
  }
}

// redstone przedluza, glowstone podbija poziom i skraca
{
  for (const p of POTIONS) {
    const base = p.forms.base.effects[0]
    if (!base || !base.seconds) continue

    if (p.forms.long) {
      const long = p.forms.long.effects[0]
      assert.ok(long.seconds > base.seconds, `${p.key}: przedluzona nie jest dluzsza`)
      assert.equal(long.level, base.level, `${p.key}: przedluzona zmienia poziom`)
    }

    if (p.forms.strong) {
      const strong = p.forms.strong.effects[0]
      assert.ok(strong.level > base.level, `${p.key}: wzmocniona nie podbija poziomu`)
      // mistrz zolwi jest wyjatkiem — poziom rosnie, czas zostaje
      assert.ok(strong.seconds <= base.seconds, `${p.key}: wzmocniona wydluza czas`)
    }
  }
}

// lancuch warzenia zaczyna sie od brodawki poza wyjatkami z wiki
{
  const noWart = POTIONS.filter(p => p.brew?.length && p.brew[0].ingredient !== 'nether_wart')
  assert.deepEqual(noWart.map(p => p.key).sort(), ['mundane', 'thick', 'weakness'])

  for (const p of POTIONS) {
    if (!p.brew) continue
    for (const step of p.brew) {
      assert.ok(byKey(step.result), `${p.key}: krok wskazuje na nieznana miksture ${step.result}`)
    }
  }

  assert.equal(byKey('luck').brew, undefined, 'szczescie nie jest warzalne')
  assert.deepEqual(byKey('water').brew, [])
}

// psucie sfermentowanym okiem: dwa kroki plus alternatywa
{
  for (const key of ['slowness', 'harming', 'invisibility']) {
    const p = byKey(key)
    assert.equal(p.brew.at(-1).ingredient, 'fermented_spider_eye', `${key} nie konczy sie okiem`)
    assert.equal(p.brew.length, 3, `${key} ma zla dlugosc lancucha`)
  }

  assert.equal(byKey('slowness').alt.from, 'leaping')
  assert.equal(byKey('harming').alt.from, 'poison')
  assert.equal(byKey('invisibility').alt, undefined)
  assert.equal(byKey('weakness').brew.length, 1, 'slabosc idzie wprost z wody')
}

// komendy: komponenty od 1.20.5, stare NBT nizej, strzaly po 8 sztuk
{
  assert.equal(
    potionCommand('swiftness', 'potion', 'modern'),
    '/give @p minecraft:potion[potion_contents={potion:"minecraft:swiftness"}]'
  )
  assert.equal(
    potionCommand('long_swiftness', 'splash_potion', 'modern', '@a'),
    '/give @a minecraft:splash_potion[potion_contents={potion:"minecraft:long_swiftness"}]'
  )
  assert.equal(
    potionCommand('strong_healing', 'potion', 'legacy'),
    '/give @p minecraft:potion{Potion:"minecraft:strong_healing"}'
  )
  assert.equal(
    potionCommand('poison', 'tipped_arrow', 'modern'),
    '/give @p minecraft:tipped_arrow[potion_contents={potion:"minecraft:poison"}] 8'
  )
  assert.equal(
    potionCommand('poison', 'tipped_arrow', 'legacy'),
    '/give @p minecraft:tipped_arrow{Potion:"minecraft:poison"} 8'
  )
}

// mikstury bez efektu nie dostaja strzal
{
  assert.deepEqual(itemsFor(byKey('water')), POTION_ITEMS.filter(i => i !== 'tipped_arrow'))
  assert.deepEqual(itemsFor(byKey('swiftness')), POTION_ITEMS)
  assert.equal(hasEffects(byKey('awkward')), false)
  assert.equal(hasEffects(byKey('luck')), true)
}

// skrocenia czasu: chmura 1/4, strzala 1/8, natychmiastowe bez zmian
{
  assert.equal(itemDuration(180, 'potion'), 180)
  assert.equal(itemDuration(180, 'splash_potion'), 180)
  assert.equal(itemDuration(180, 'lingering_potion'), 45)
  assert.equal(itemDuration(180, 'tipped_arrow'), 23)
  assert.equal(itemDuration(0, 'lingering_potion'), 0)
}

// formatowanie czasu i poziomow
{
  assert.equal(formatDuration(180), '3:00')
  assert.equal(formatDuration(45), '0:45')
  assert.equal(formatDuration(22), '0:22')
  assert.equal(formatDuration(480), '8:00')
  assert.equal(roman(1), 'I')
  assert.equal(roman(4), 'IV')
  assert.equal(roman(6), 'VI')
}

// wybrane wartosci z minecraft.wiki dla 1.21
{
  const expect = {
    swiftness: { base: 180, long: 480, strong: 90 },
    regeneration: { base: 45, long: 90, strong: 22 },
    poison: { base: 45, long: 90, strong: 21 },
    slowness: { base: 90, long: 240, strong: 20 },
    weakness: { base: 90, long: 240 },
    slow_falling: { base: 90, long: 240 },
    luck: { base: 300 },
    oozing: { base: 180 }
  }

  for (const [key, variants] of Object.entries(expect)) {
    for (const [v, seconds] of Object.entries(variants)) {
      assert.equal(byKey(key).forms[v].effects[0].seconds, seconds, `${key}/${v}`)
    }
  }

  const turtle = byKey('turtle_master')
  assert.deepEqual(turtle.forms.base.effects.map(e => [e.effect, e.level, e.seconds]), [
    ['slowness', 4, 20], ['resistance', 3, 20]
  ])
  assert.deepEqual(turtle.forms.strong.effects.map(e => [e.effect, e.level, e.seconds]), [
    ['slowness', 6, 20], ['resistance', 4, 20]
  ])

  for (const key of ['healing', 'harming']) {
    for (const v of availableVariants(byKey(key))) {
      assert.equal(byKey(key).forms[v].effects[0].seconds, 0, `${key} ma byc natychmiastowa`)
    }
    assert.equal(byKey(key).forms.long, undefined, `${key} nie ma wariantu przedluzonego`)
  }

  for (const key of ['wind_charging', 'oozing', 'weaving', 'infestation']) {
    assert.deepEqual(availableVariants(byKey(key)), ['base'], `${key} nie ma miec wariantow`)
  }
}

// modyfikator wariantu
{
  assert.equal(variantIngredient('long'), 'redstone')
  assert.equal(variantIngredient('strong'), 'glowstone')
  assert.equal(variantIngredient('base'), '')
}

// tlumaczenia pokrywaja wszystkie klucze uzyte przez dane
{
  const effects = new Set(POTIONS.flatMap(p =>
    POTION_VARIANTS.flatMap(v => p.forms[v]?.effects.map(e => e.effect) || [])))
  const ingredients = new Set(POTIONS.flatMap(p => [
    ...(p.brew || []).map(s => s.ingredient),
    ...(p.alt ? [p.alt.ingredient] : [])
  ]).concat(['redstone', 'glowstone', 'gunpowder', 'dragon_breath', 'blaze_powder']))

  for (const [loc, dict] of [['en', en], ['pl', pl]]) {
    for (const p of POTIONS) assert.ok(dict.names[p.key], `${loc}: brak nazwy ${p.key}`)
    for (const e of effects) assert.ok(dict.effects[e], `${loc}: brak efektu ${e}`)
    for (const i of ingredients) assert.ok(dict.ingredients[i], `${loc}: brak skladnika ${i}`)
    assert.equal(Object.keys(dict.names).length, POTIONS.length, `${loc}: zbedne nazwy mikstur`)
  }
}

// kazda mikstura ma teksture na dysku, a kolor zgadza sie z jej barwieniem
{
  for (const p of POTIONS) {
    const path = new URL('../public' + potionTexture(p.key), import.meta.url)
    assert.ok(existsSync(path), `${p.key}: brak tekstury ${potionTexture(p.key)}`)
  }

  // odzyskane z tekstur wiki, patrz scratchpad/tint3.mjs
  const fromTexture = {
    swiftness: '#33EBFF', leaping: '#FDFF84', strength: '#FFC700', healing: '#F82423',
    regeneration: '#CD5CAB', fire_resistance: '#FF9900', water_breathing: '#98DAC0',
    night_vision: '#C2FF66', invisibility: '#F6F6F6', slow_falling: '#F3CFB9',
    luck: '#59C106', turtle_master: '#8D82E6', wind_charging: '#BDC9FF', oozing: '#99FFA3',
    weaving: '#78695A', infestation: '#8C9B8C', slowness: '#8BAFE0', poison: '#87A363',
    harming: '#A9656A', weakness: '#484D48', water: '#385DC6'
  }
  for (const [key, hex] of Object.entries(fromTexture)) {
    assert.equal(byKey(key).color, hex, `${key}: kolor rozjechany z tekstura`)
  }
  for (const key of ['awkward', 'mundane', 'thick']) {
    assert.equal(byKey(key).color, byKey('water').color, `${key} ma barwic sie jak woda`)
    assert.equal(potionTexture(key), potionTexture('water'), `${key} ma uzywac tekstury wody`)
  }
}

// kazdy skladnik uzyty w danych ma teksture na dysku
{
  const used = new Set([
    ...POTIONS.flatMap(p => (p.brew || []).map(s => s.ingredient)),
    ...POTIONS.flatMap(p => (p.alt ? [p.alt.ingredient] : [])),
    ...INGREDIENTS.map(i => i.key),
    'redstone', 'glowstone'
  ])

  for (const key of used) {
    const path = new URL('../public' + ingredientTexture(key), import.meta.url)
    assert.ok(existsSync(path), `brak tekstury skladnika: ${ingredientTexture(key)}`)
  }
}

// kategorie zgodne z MobEffectCategory w vanilli
{
  const cats = Object.fromEntries(POTIONS.map(p => [p.key, p.cat]))
  for (const k of ['wind_charging', 'oozing', 'weaving', 'infestation', 'slowness', 'poison', 'harming', 'weakness']) {
    assert.equal(cats[k], 'negative', `${k} ma byc negatywna`)
  }
  for (const k of ['swiftness', 'healing', 'luck', 'turtle_master', 'slow_falling']) {
    assert.equal(cats[k], 'positive', `${k} ma byc pozytywna`)
  }
  for (const k of ['water', 'awkward', 'mundane', 'thick']) {
    assert.equal(cats[k], 'base', `${k} ma byc bazowa`)
  }
}

console.log('potion: ok')
