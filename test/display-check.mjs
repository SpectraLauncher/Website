// node --experimental-strip-types test/display-check.mjs
import assert from 'node:assert/strict'
import {
  quatFromEuler, argbInt, namespaced, textComponent, displayNbt, displayCommand,
  defaultDisplay, DISPLAY_PRESETS, DEFAULT_BACKGROUND, MAX_CHAT
} from '../app/utils/displayEntity.ts'
import { emptySegment } from '../app/utils/tellraw.ts'

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} != ${b}`)

const state = (over = {}) => ({ ...defaultDisplay(), ...over })

const seg = (text, over = {}) => ({ ...emptySegment(text), ...over })

// kwaternion: kolejnosc YXZ, wyjscie [x, y, z, w]
{
  assert.deepEqual(quatFromEuler({ yaw: 0, pitch: 0, roll: 0 }), [0, 0, 0, 1])

  const yaw = quatFromEuler({ yaw: 90, pitch: 0, roll: 0 })
  near(yaw[0], 0, 'yaw x')
  near(yaw[1], Math.SQRT1_2, 'yaw y')
  near(yaw[2], 0, 'yaw z')
  near(yaw[3], Math.SQRT1_2, 'yaw w')

  const pitch = quatFromEuler({ yaw: 0, pitch: 90, roll: 0 })
  near(pitch[0], Math.SQRT1_2, 'pitch x')
  near(pitch[3], Math.SQRT1_2, 'pitch w')

  const roll = quatFromEuler({ yaw: 0, pitch: 0, roll: 90 })
  near(roll[2], Math.SQRT1_2, 'roll z')
  near(roll[3], Math.SQRT1_2, 'roll w')

  const both = quatFromEuler({ yaw: 90, pitch: 90, roll: 0 })
  near(both[0], 0.5, 'yxz x')
  near(both[1], 0.5, 'yxz y')
  near(both[2], -0.5, 'yxz z')
  near(both[3], 0.5, 'yxz w')

  for (const q of [both, quatFromEuler({ yaw: 33, pitch: -12, roll: 200 })]) {
    near(Math.hypot(...q), 1, 'jednostkowa dlugosc')
  }
}

// ARGB tla jest 32-bitowym intem ze znakiem
{
  assert.equal(argbInt('#000000', 64), DEFAULT_BACKGROUND)
  assert.equal(argbInt('#100E1E', 200), -938471906)
  assert.equal(argbInt('#2A0000', 140), -1943404544)
  assert.equal(argbInt('#000000', 0), 0)
}

// id bez przestrzeni nazw dostaje minecraft:
{
  assert.equal(namespaced('diamond_block'), 'minecraft:diamond_block')
  assert.equal(namespaced('  Stone '), 'minecraft:stone')
  assert.equal(namespaced('mod:thing'), 'mod:thing')
  assert.equal(namespaced(''), '')
}

// domyslna encja nie niesie zadnych pol poza trescia
{
  const nbt = displayNbt(state({ segments: [seg('hi')] }))
  assert.equal(nbt, '{text:{text:"hi"}}')
  assert.ok(!nbt.includes('transformation'))
  assert.ok(!nbt.includes('billboard'))
}

// jeden fragment to obiekt, kilka to lista z pustym rodzicem
{
  assert.equal(textComponent([seg('hi')], 'modern'), '{text:"hi"}')
  assert.equal(
    textComponent([seg('a'), seg('b', { color: 'red', bold: true })], 'modern'),
    '["",{text:"a"},{text:"b",color:"red",bold:true}]'
  )
  assert.equal(textComponent([], 'modern'), '""')
}

// 1.19.4-1.21.4: komponent jako JSON w apostrofach, bez ucieczek na cudzyslowach
{
  const legacy = textComponent([seg('a'), seg('b')], 'legacy')
  assert.equal(legacy, `'["",{"text":"a"},{"text":"b"}]'`)
  assert.ok(!legacy.includes('\\"'))

  // apostrof w tresci musi byc uciekniety, inaczej zamyka string SNBT
  const risky = textComponent([seg("it's")], 'legacy')
  assert.equal(risky, `'{"text":"it\\'s"}'`)
}

// text_opacity to bajt ze znakiem — 200 nie przejdzie parsera jako 200b
{
  assert.ok(displayNbt(state({ segments: [seg('x')], textOpacity: 25 })).includes('text_opacity:25b'))
  assert.ok(displayNbt(state({ segments: [seg('x')], textOpacity: 200 })).includes('text_opacity:-56b'))
  assert.ok(!displayNbt(state({ segments: [seg('x')], textOpacity: 255 })).includes('text_opacity'))
}

// transformacja wychodzi w calosci, gdy cokolwiek odbiega od domyslnego
{
  const scaled = displayNbt(state({ segments: [seg('x')], scale: { x: 2, y: 2, z: 2 } }))
  assert.ok(scaled.includes('left_rotation:[0f,0f,0f,1f]'))
  assert.ok(scaled.includes('right_rotation:[0f,0f,0f,1f]'))
  assert.ok(scaled.includes('translation:[0f,0f,0f]'))
  assert.ok(scaled.includes('scale:[2f,2f,2f]'))

  const turned = displayNbt(state({ segments: [seg('x')], left: { yaw: 90, pitch: 0, roll: 0 } }))
  assert.ok(turned.includes('left_rotation:[0f,0.70711f,0f,0.70711f]'), turned)
}

// bloki i przedmioty
{
  assert.ok(displayNbt(state({ kind: 'block', blockId: 'oak_log' })).includes('block_state:{Name:"minecraft:oak_log"}'))

  const withProps = displayNbt(state({
    kind: 'block',
    blockId: 'oak_log',
    blockProps: [{ key: 'axis', value: 'z' }, { key: '', value: 'ignored' }]
  }))
  assert.ok(withProps.includes('Properties:{axis:"z"}'), withProps)
  assert.ok(!withProps.includes('ignored'))

  assert.ok(displayNbt(state({ kind: 'item' })).includes('item:{id:"minecraft:diamond_sword",count:1}'))
  assert.ok(displayNbt(state({ kind: 'item', version: 'legacy' })).includes('Count:1b'))
  assert.ok(displayNbt(state({ kind: 'item', itemContext: 'gui' })).includes('item_display:"gui"'))
  assert.ok(!displayNbt(state({ kind: 'item' })).includes('item_display'))
}

// pozostale pola tylko przy odstepstwie od domyslnych
{
  const loaded = state({
    segments: [seg('x')],
    billboard: 'center',
    brightnessOverride: true,
    viewRange: 0.5,
    shadowRadius: 0.25,
    shadowStrength: 0.95,
    glowing: true,
    glowOverride: true,
    glowColor: '#FF3030',
    interpolationDuration: 40,
    startInterpolation: 5,
    teleportDuration: 3,
    align: 'left',
    lineWidth: 120,
    shadow: true,
    seeThrough: true
  })
  const nbt = displayNbt(loaded)

  for (const part of [
    'billboard:"center"', 'brightness:{block:15,sky:15}', 'view_range:0.5f',
    'shadow_radius:0.25f', 'shadow_strength:0.95f', 'Glowing:1b',
    'glow_color_override:16724016', 'interpolation_duration:40',
    'start_interpolation:5', 'teleport_duration:3', 'alignment:"left"',
    'line_width:120', 'shadow:1b', 'see_through:1b'
  ]) {
    assert.ok(nbt.includes(part), `brakuje ${part} w ${nbt}`)
  }
}

// default_background wygrywa z kolorem tla, wiec background nie jest wypisywany
{
  const nbt = displayNbt(state({ segments: [seg('x')], defaultBackground: true, bgAlpha: 200, bgColor: '#112233' }))
  assert.ok(nbt.includes('default_background:1b'))
  assert.ok(!nbt.includes('background:-'))
}

// komenda: typ encji, pozycja, puste wspolrzedne wracaja do ~
{
  const cmd = displayCommand(state({ segments: [seg('hi')] }))
  assert.equal(cmd, '/summon minecraft:text_display ~ ~1 ~ {text:{text:"hi"}}')

  assert.ok(displayCommand(state({ kind: 'block' })).startsWith('/summon minecraft:block_display'))
  assert.ok(displayCommand(state({ pos: { x: '', y: '10', z: '^2' } })).includes(' ~ 10 ^2 '))
}

// kazdy gotowiec generuje sensowna komende
{
  for (const preset of DISPLAY_PRESETS) {
    const cmd = displayCommand(preset.patch(defaultDisplay()))
    assert.ok(cmd.startsWith('/summon minecraft:'), preset.key)
    assert.ok(cmd.length < MAX_CHAT * 2, `${preset.key} nadmiernie dlugi`)
    assert.equal((cmd.match(/\{/g) || []).length, (cmd.match(/\}/g) || []).length, `${preset.key} nawiasy`)
  }

  const shop = displayCommand(DISPLAY_PRESETS.find(p => p.key === 'shop').patch(defaultDisplay()))
  assert.ok(shop.includes('background:-938471906'), shop)
  assert.ok(shop.includes('\\n'), shop)
}

console.log('display: ok')
