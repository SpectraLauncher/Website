// node --experimental-strip-types test/skin-pose-check.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { POSES, CROPS, RENDER_CROPS, PIVOTS, LIMB_SEGMENTS, BENDABLE, mitreFor, mitreOffset, poseById, isRenderCrop, posedParts, cameraFor } from '../app/utils/skinPose.ts'
import { renderSkin } from '../app/utils/skinRender.ts'
import { PARTS, SKIN_SIZE, boxFaces } from '../app/utils/skin.ts'

const en = JSON.parse(readFileSync(new URL('../i18n/locales/en.json', import.meta.url), 'utf8'))

/** Tekstura testowa: kazda czesc dostaje wlasny, rozpoznawalny kolor. */
const PART_COLOUR = {
  head: [255, 0, 0],
  body: [0, 255, 0],
  rightArm: [0, 0, 255],
  leftArm: [255, 255, 0],
  rightLeg: [255, 0, 255],
  leftLeg: [0, 255, 255]
}

function testTexture() {
  const data = new Uint8ClampedArray(SKIN_SIZE * SKIN_SIZE * 4)

  for (const part of PARTS) {
    const [w, h, d] = part.size
    for (const face of boxFaces(part.uv[0], part.uv[1], w, h, d)) {
      for (let y = face.y; y < face.y + face.h; y++) {
        for (let x = face.x; x < face.x + face.w; x++) {
          const o = (y * SKIN_SIZE + x) * 4
          const c = PART_COLOUR[part.id]
          data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255
        }
      }
    }
  }

  return { data, width: SKIN_SIZE, height: SKIN_SIZE }
}

const SKIN = testTexture()

const render = (over = {}) => renderSkin({
  skin: SKIN, pose: poseById('front'), crop: 'full', model: 'classic', size: 96, ...over
})

const stats = (result) => {
  const seen = new Map()
  let opaque = 0
  for (let i = 0; i < result.data.length; i += 4) {
    if (result.data[i + 3] < 16) continue
    opaque++
    // cieniowanie skaluje kanaly, wiec porownujemy dominujacy kanal
    const [r, g, b] = [result.data[i], result.data[i + 1], result.data[i + 2]]
    const key = `${r > 40 ? 1 : 0}${g > 40 ? 1 : 0}${b > 40 ? 1 : 0}`
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  return { opaque, seen }
}

// pozy sa spojne: unikalne id, znane czesci, katy w rozsadnym zakresie
{
  const ids = POSES.map(p => p.id)
  assert.equal(new Set(ids).size, ids.length, 'zdublowana poza')
  assert.ok(ids.includes('default'), 'musi byc poza domyslna')

  const known = new Set([
    ...PARTS.map(p => p.id),
    ...Object.values(LIMB_SEGMENTS).map(seg => seg.lower)
  ])
  for (const pose of POSES) {
    for (const [part, rot] of Object.entries(pose.parts)) {
      assert.ok(known.has(part), `${pose.id}: nieznana czesc ${part}`)
      assert.equal(rot.length, 3, `${pose.id}/${part}: potrzebne trzy katy`)
      for (const angle of rot) {
        assert.ok(Number.isFinite(angle) && Math.abs(angle) <= 180, `${pose.id}/${part}: kat ${angle} poza zakresem`)
      }
    }

    const cam = cameraFor(pose)
    assert.ok(cam.distance > 0 && cam.zoom > 0, `${pose.id}: zla kamera`)
    assert.equal(cam.target.length, 3)
  }

  assert.equal(poseById('nie-ma'), undefined)
}

// kazdy staw ma punkt obrotu i lezy tam, gdzie laczy sie z tulowiem
{
  for (const part of PARTS) {
    assert.ok(PIVOTS[part.id], `${part.id}: brak punktu obrotu`)
  }
  assert.deepEqual(PIVOTS.head, [0, 24, 0], 'glowa obraca sie w szyi')
  assert.equal(PIVOTS.rightArm[0], -PIVOTS.leftArm[0], 'barki symetryczne')
  assert.equal(PIVOTS.rightLeg[0], -PIVOTS.leftLeg[0], 'biodra symetryczne')
  assert.ok(PIVOTS.rightArm[1] > PIVOTS.rightLeg[1], 'bark wyzej niz biodro')
}

// kadry: pelny pokazuje wszystko, popiersie gubi nogi, glowa tylko glowe
{
  assert.deepEqual(RENDER_CROPS.filter(isRenderCrop), RENDER_CROPS)
  assert.equal(isRenderCrop('nope'), false)

  const full = stats(render({ crop: 'full' }))
  const bust = stats(render({ crop: 'bust' }))
  const head = stats(render({ crop: 'head' }))

  assert.ok(full.opaque > 0, 'pelny kadr ma cokolwiek narysowac')
  assert.ok(full.seen.has('101'), 'pelny kadr pokazuje lewa noge')
  assert.ok(!bust.seen.has('101'), 'popiersie nie pokazuje nog')
  assert.ok(bust.seen.has('100'), 'popiersie pokazuje glowe')

  // w kadrze glowy zostaje tylko czerwien glowy
  const colours = [...head.seen.keys()]
  assert.deepEqual(colours, ['100'], `kadr glowy pokazuje ${colours.join(',')}`)
}

// barebones gasi warstwe zewnetrzna, processed ja zostawia
{
  assert.equal(CROPS.barebones.overlay, false)
  assert.equal(CROPS.processed.overlay, true)

  const withOverlay = posedParts(poseById('default'), 'classic', true)
  const without = posedParts(poseById('default'), 'classic', false)
  assert.ok(withOverlay.length > without.length, 'warstwa zewnetrzna dokłada bryly')
  assert.equal(without.filter(p => p.overlay).length, 0)
}

// smukly model zweza ramiona i przesuwa ich bark
{
  const classic = posedParts(poseById('default'), 'classic', false)
  const slim = posedParts(poseById('default'), 'slim', false)

  const pair = id => [classic.find(p => p.id === id), slim.find(p => p.id === id)]
  const [cArm, sArm] = pair('rightArm')
  assert.equal(cArm.size[0], 4)
  assert.equal(sArm.size[0], 3)
  assert.ok(
    Math.abs(sArm.joints[0].pivot[0]) < Math.abs(cArm.joints[0].pivot[0]),
    'bark idzie blizej tulowia'
  )

  const [cLeg, sLeg] = pair('rightLeg')
  assert.deepEqual(sLeg.size, cLeg.size, 'nogi nie zmieniaja sie przy smuklym')
}

// staw w polowie konczyny: bez zgiecia jedna bryla, ze zgieciem dwie
{
  assert.deepEqual(BENDABLE.sort(), ['leftArm', 'leftLeg', 'rightArm', 'rightLeg'])
  assert.equal(LIMB_SEGMENTS.rightArm.joint, 18, 'lokiec w polowie ramienia')
  assert.equal(LIMB_SEGMENTS.rightLeg.joint, 6, 'kolano w polowie nogi')

  const straight = posedParts({ id: 'x', parts: {}, camera: {} }, 'classic', false)
  assert.equal(straight.filter(p => p.id === 'rightArm').length, 1)
  assert.equal(straight.find(p => p.id === 'rightForearm'), undefined, 'bez zgiecia nie ma przedramienia')
  assert.equal(straight.find(p => p.id === 'rightArm').segment, undefined, 'cala bryla nie jest segmentem')

  const bent = posedParts(
    { id: 'x', parts: { rightArm: [-90, 0, 0], rightForearm: [-90, 0, 0] }, camera: {} },
    'classic',
    false
  )

  const upper = bent.find(p => p.id === 'rightArm')
  const lower = bent.find(p => p.id === 'rightForearm')
  assert.ok(upper && lower, 'zgiecie ma dac dwa segmenty')

  assert.equal(upper.size[1], 6, 'gorny segment to polowa ramienia')
  assert.equal(lower.size[1], 6, 'dolny segment to druga polowa')
  assert.equal(upper.segment.fromTop, 0)
  assert.equal(lower.segment.fromTop, 6, 'dolny segment czyta dolna polowe tekstury')

  // dolny dziedziczy obrot gornego, wiec ma dluzszy lancuch
  assert.equal(upper.joints.length, 1)
  assert.equal(lower.joints.length, 2)
  assert.deepEqual(lower.joints[1], upper.joints[0], 'rodzicem dolnego jest bark')
  assert.equal(lower.joints[0].pivot[1], 18, 'wlasny staw dolnego to lokiec')

  // os stawu musi lezec w srodku bryly, inaczej segmenty rozjezdzaja sie w bok
  assert.equal(lower.joints[0].pivot[0], upper.centre[0], 'staw w srodku konczyny w osi X')
  assert.equal(lower.joints[0].pivot[2], upper.centre[2], 'staw w srodku konczyny w osi Z')
  assert.notEqual(lower.joints[0].pivot[0], upper.joints[0].pivot[0], 'bark lezy gdzie indziej niz lokiec')

  assert.equal(upper.centre[1] + upper.size[1] / 2, 24, 'gora ramienia na miejscu')
  assert.equal(lower.centre[1] - lower.size[1] / 2, 12, 'dol ramienia na miejscu')
  assert.equal(upper.centre[1] - upper.size[1] / 2, 18, 'segmenty stykaja sie w stawie')
  assert.equal(lower.centre[1] + lower.size[1] / 2, 18)
}

// ciecie na jerzyk: wzor zgadza sie z postacia zamknieta dla czystego zawiasu
{
  for (const theta of [40, 90, 110, -118]) {
    const t = Math.tan((theta * Math.PI / 180) / 2)
    const up = mitreFor([theta, 0, 0], -1)
    const lo = mitreFor([theta, 0, 0], 1)

    for (const z of [-2, 2]) {
      assert.ok(Math.abs(mitreOffset(up, 0, z) - (-z * t)) < 1e-9, `${theta}: gorny rog`)
      assert.ok(Math.abs(mitreOffset(lo, 0, z) - (z * t)) < 1e-9, `${theta}: dolny rog`)
    }
  }

  // bez zgiecia plaszczyzna ciecia jest plaska
  const flat = mitreFor([0, 0, 0], -1)
  assert.ok(Math.abs(mitreOffset(flat, 2, 2)) < 1e-12, 'proste ramie nie moze byc ciete skosnie')
}

// staw jest zawiasem jednoosiowym, wiec obie scianki ciecia pokrywaja sie co do punktu
{
  const RAD = Math.PI / 180
  const spin = (p, r) => {
    const [rx, ry, rz] = [r[0] * RAD, r[1] * RAD, r[2] * RAD]
    let [x, y, z] = p
    const cx = Math.cos(rx), sx = Math.sin(rx); [y, z] = [y * cx - z * sx, y * sx + z * cx]
    const cz = Math.cos(rz), sz = Math.sin(rz); [x, y] = [x * cz - y * sz, x * sz + y * cz]
    const cy = Math.cos(ry), sy = Math.sin(ry); [x, z] = [x * cy + z * sy, -x * sy + z * cy]
    return [x, y, z]
  }

  const seam = (pose, upperId) => {
    const parts = posedParts(pose, 'slim', true)
    const up = parts.find(p => p.id === upperId && !p.overlay)
    const lo = parts.find(p => p.id === LIMB_SEGMENTS[upperId].lower && !p.overlay)
    if (!up || !lo) return 0

    let worst = 0
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const dx = sx * up.size[0] / 2
      const dz = sz * up.size[2] / 2
      const a = [dx, mitreOffset(up.mitre, dx, dz), dz]
      const b = spin([dx, mitreOffset(lo.mitre, dx, dz), dz], lo.joints[0].rotation)
      worst = Math.max(worst, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]))
    }
    return worst
  }

  for (const pose of POSES) {
    for (const upperId of BENDABLE) {
      const gap = seam(pose, upperId)
      assert.ok(gap < 1e-6, `${pose.id}/${upperId}: scianki ciecia rozjezdzaja sie o ${gap.toFixed(4)}px`)
    }
  }
}

// zgiecie realnie zmienia obraz, a nie tylko strukture
{
  const flat = renderSkin({ skin: SKIN, pose: poseById('front'), crop: 'full', model: 'classic', size: 96 })
  const knee = renderSkin({
    skin: SKIN,
    pose: { id: 'x', parts: { rightLeg: [-90, 0, 0], rightShin: [110, 0, 0] }, camera: { yaw: 0, pitch: 0 } },
    crop: 'full',
    model: 'classic',
    size: 96
  })
  assert.notDeepEqual(flat.data, knee.data, 'zgiete kolano ma dac inny render')
  assert.ok(stats(knee).opaque > 200, 'zgieta noga nie moze zniknac')
}

// render jest deterministyczny i wypelnia kadr
{
  const a = render()
  const b = render()
  assert.deepEqual(a.data, b.data, 'ten sam wejscie ma dac ten sam wynik')
  assert.equal(a.width, 96)
  assert.equal(a.height, 96)

  const { opaque } = stats(a)
  const total = 96 * 96
  assert.ok(opaque > total * 0.08, `render prawie pusty (${opaque}/${total})`)
  assert.ok(opaque < total * 0.9, `render podejrzanie pelny (${opaque}/${total})`)
}

// bufor glebi dziala: z przodu widac klatke piersiowa, nie plecy
{
  const front = render({ pose: poseById('front'), crop: 'bust', size: 64 })
  const mid = ((32 * 64) + 32) * 4
  assert.ok(front.data[mid + 3] > 0, 'srodek popiersia ma byc zamalowany')
}

// kazda poza w kazdym kadrze renderuje sie bez wyjatku i cos rysuje
{
  for (const pose of POSES) {
    for (const crop of RENDER_CROPS) {
      const result = renderSkin({ skin: SKIN, pose, crop, model: 'slim', size: 48 })
      assert.equal(result.width, 48, `${pose.id}/${crop}: zla szerokosc`)
      const { opaque } = stats(result)
      assert.ok(opaque > 20, `${pose.id}/${crop}: pusty render`)
    }
  }
}

// rozmiar wyjscia jest respektowany
{
  for (const size of [32, 128, 256]) {
    const r = render({ size })
    assert.equal(r.width, size)
    assert.equal(r.height, size)
    assert.equal(r.data.length, size * size * 4)
  }
}

// nazwy poz i kadrow sa opisane po angielsku
{
  const p = en.skinPoses
  assert.ok(p, 'brak sekcji skinPoses')
  for (const pose of POSES) assert.ok(p.poses[pose.id], `brak nazwy pozy ${pose.id}`)
  for (const crop of RENDER_CROPS) assert.ok(p.crops[crop], `brak nazwy kadru ${crop}`)
}

// przesuniecia czesci: wlasne przesuwa jedna bryle, przesuniecie tulowia niesie dzieci
{
  const at = (pose, id) => {
    const part = posedParts(pose, 'classic', false).find(p => p.id === id)
    let point = [part.centre[0], part.centre[1], part.centre[2]]
    for (const joint of part.joints) {
      const o = joint.offset ?? [0, 0, 0]
      point = [point[0] + o[0], point[1] + o[1], point[2] + o[2]]
    }
    return point
  }

  const rest = { id: 'x', parts: {}, camera: {} }
  const arm = { id: 'x', parts: {}, offsets: { rightArm: [0, 0, 5] }, camera: {} }
  const torso = { id: 'x', parts: {}, offsets: { body: [0, -3, 0] }, camera: {} }

  assert.deepEqual(at(arm, 'rightArm'), at(rest, 'rightArm').map((v, i) => v + [0, 0, 5][i]))
  assert.deepEqual(at(arm, 'leftArm'), at(rest, 'leftArm'))

  for (const id of ['head', 'rightArm', 'rightLeg']) {
    assert.deepEqual(at(torso, id), at(rest, id).map((v, i) => v + [0, -3, 0][i]), `tulow nie niesie ${id}`)
  }

  const before = stats(render({ pose: rest }))
  const after = stats(render({ pose: arm }))
  assert.notDeepEqual(before, after, 'przesuniecie nie zmienilo renderu')
}

console.log('skin-pose: ok')
