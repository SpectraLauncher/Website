// node --experimental-strip-types test/skin-check.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PARTS, SKIN_SIZE, OVERLAY_INFLATE, CAPE_SOURCES, LEGACY_COPIES,
  boxFaces, capeFaces, capeScale, CAPE_LAYOUTS, partGeometry, isLegacySkin, skinFileName,
  stripLegacyHat, LEGACY_HAT, normaliseQuery, capeTextureUrl, isEquipped,
  HEAD_CROP, HEAD_OVERLAY_CROP
} from '../app/utils/skin.ts'
import { TOOLS } from '../app/utils/tools.ts'

const en = JSON.parse(readFileSync(new URL('../i18n/locales/en.json', import.meta.url), 'utf8'))
const pl = JSON.parse(readFileSync(new URL('../i18n/locales/pl.json', import.meta.url), 'utf8'))

const inside = (r, size = SKIN_SIZE) =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= size && r.y + r.h <= size

// kolejnosc scianek odpowiada BoxGeometry: +X, -X, +Y, -Y, +Z, -Z.
// +X to lewy bok gracza, bo tam U biegnie od przodu do tylu — odwrotnie niz na -X.
{
  const head = boxFaces(0, 0, 8, 8, 8)
  assert.equal(head.length, 6, 'szescian ma szesc scianek')

  const [plusX, minusX, top, bottom, front, back] = head
  assert.deepEqual(front, { x: 8, y: 8, w: 8, h: 8 }, 'twarz siedzi w 8,8')
  assert.deepEqual(top, { x: 8, y: 0, w: 8, h: 8 })
  assert.deepEqual(bottom, { x: 16, y: 0, w: 8, h: 8, flipV: true }, 'dol jest odbity w pionie')
  assert.deepEqual(plusX, { x: 16, y: 8, w: 8, h: 8 }, '+X to lewy bok gracza')
  assert.deepEqual(minusX, { x: 0, y: 8, w: 8, h: 8 }, '-X to prawy bok gracza')
  assert.deepEqual(back, { x: 24, y: 8, w: 8, h: 8 })

  assert.ok(!top.flipV, 'gora nie jest odbijana')
  assert.ok(!front.flipV && !back.flipV && !plusX.flipV && !minusX.flipV, 'boki nie sa odbijane')

  // pasek scianek ma dokladnie szerokosc 2*(w+d)
  const span = Math.max(...head.map(f => f.x + f.w)) - Math.min(...head.map(f => f.x))
  assert.equal(span, 2 * (8 + 8))
}

// tulow nie jest szescianem, wiec sprawdzamy prostokatny przypadek
{
  const [plusX, minusX, top, bottom, front, back] = boxFaces(16, 16, 8, 12, 4)
  assert.deepEqual(front, { x: 20, y: 20, w: 8, h: 12 })
  assert.deepEqual(back, { x: 32, y: 20, w: 8, h: 12 })
  assert.deepEqual(plusX, { x: 28, y: 20, w: 4, h: 12 })
  assert.deepEqual(minusX, { x: 16, y: 20, w: 4, h: 12 })
  assert.deepEqual(top, { x: 20, y: 16, w: 8, h: 4 })
  assert.deepEqual(bottom, { x: 28, y: 16, w: 8, h: 4, flipV: true })
}

// wszystkie czesci i ich warstwy zewnetrzne mieszcza sie w teksturze 64x64
{
  const ids = PARTS.map(p => p.id)
  assert.equal(new Set(ids).size, ids.length, 'zdublowana czesc modelu')
  assert.deepEqual(ids, ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg'])

  for (const part of PARTS) {
    for (const model of ['classic', 'slim']) {
      const { size } = partGeometry(part, model)
      const [w, h, d] = size

      for (const face of boxFaces(part.uv[0], part.uv[1], w, h, d)) {
        assert.ok(inside(face), `${part.id}/${model}: scianka poza tekstura ${JSON.stringify(face)}`)
      }
      if (!part.overlayUv) continue
      for (const face of boxFaces(part.overlayUv[0], part.overlayUv[1], w, h, d)) {
        assert.ok(inside(face), `${part.id}/${model}: warstwa poza tekstura ${JSON.stringify(face)}`)
      }
    }
  }
}

// smukly model zweza tylko rece i przesuwa ich srodek do tulowia
{
  for (const part of PARTS) {
    const classic = partGeometry(part, 'classic')
    const slim = partGeometry(part, 'slim')

    if (!part.slimWidth) {
      assert.deepEqual(slim, classic, `${part.id} nie powinna sie zmieniac`)
      continue
    }

    assert.equal(slim.size[0], 3, `${part.id}: smukle ramie ma 3px`)
    assert.equal(classic.size[0], 4, `${part.id}: klasyczne ramie ma 4px`)
    assert.equal(slim.size[1], classic.size[1])
    assert.ok(Math.abs(slim.position[0]) < Math.abs(classic.position[0]), `${part.id}: smukle ramie ma isc blizej tulowia`)
  }

  const rightArm = PARTS.find(p => p.id === 'rightArm')
  const leftArm = PARTS.find(p => p.id === 'leftArm')
  assert.equal(partGeometry(rightArm, 'slim').position[0], -partGeometry(leftArm, 'slim').position[0], 'rece maja byc symetryczne')
}

// model stoi na zerze i nie schodzi ponizej
{
  for (const part of PARTS) {
    const { size, position } = partGeometry(part, 'classic')
    const bottom = position[1] - size[1] / 2
    assert.ok(bottom >= 0, `${part.id}: wchodzi pod podloge (${bottom})`)
  }

  const head = PARTS.find(p => p.id === 'head')
  const legs = PARTS.find(p => p.id === 'rightLeg')
  const top = head.position[1] + head.size[1] / 2
  assert.equal(top, 32, 'gracz ma 32 piksele wysokosci')
  assert.equal(legs.position[1] - legs.size[1] / 2, 0, 'nogi zaczynaja sie na zerze')
}

// peleryna: strona zewnetrzna to obszar 1,1, wewnetrzna 12,1
{
  const faces = capeFaces()
  assert.equal(faces.length, 6)
  assert.deepEqual(faces[5], { x: 1, y: 1, w: 10, h: 16 }, 'wzor peleryny jest na sciance tylnej')
  assert.deepEqual(faces[4], { x: 12, y: 1, w: 10, h: 16 }, 'podszewka na przedniej')
  assert.ok(faces[3].flipV, 'dol peleryny jest odbity tak samo jak dol bryly')

  // realne rozmiary zaobserwowane u dostawcow, razem z wielokrotnosciami
  const measured = [[64, 32, 1], [46, 22, 1], [92, 44, 2], [22, 17, 1], [128, 64, 2], [256, 128, 4]]

  for (const [w, h, expected] of measured) {
    assert.equal(capeScale(w, h), expected, `${w}x${h}: zla skala`)

    for (const face of capeFaces(capeScale(w, h))) {
      assert.ok(
        face.x + face.w <= w && face.y + face.h <= h,
        `${w}x${h}: scianka ${JSON.stringify(face)} wychodzi poza teksture`
      )
    }
  }

  // przy skali 1 nic sie nie zmienia, przy 2 wszystko sie podwaja
  assert.deepEqual(capeFaces(1), faces)
  for (let i = 0; i < faces.length; i++) {
    const doubled = capeFaces(2)[i]
    assert.equal(doubled.x, faces[i].x * 2, 'x ma sie skalowac')
    assert.equal(doubled.w, faces[i].w * 2, 'szerokosc ma sie skalowac')
    assert.equal(doubled.flipV, faces[i].flipV, 'skalowanie nie moze gubic odbicia')
  }

  // wzor musi wypelniac peleryne co do piksela, nie mniej
  for (const [w, h] of CAPE_LAYOUTS) {
    const outer = capeFaces(capeScale(w, h))[5]
    assert.equal(outer.w / w, 10 / w, `${w}x${h}: wzor ma zajmowac 10 jednostek bazowych`)
  }

  // nieznany rozmiar nie moze wywrocic renderu
  assert.ok(capeScale(37, 19) >= 1, 'dziwny rozmiar ma dostac sensowna skale')
}

// stary format 64x32 i jego lustrzane kopie
{
  assert.equal(isLegacySkin(64, 32), true)
  assert.equal(isLegacySkin(64, 64), false)
  assert.equal(isLegacySkin(128, 128), false)

  // szesc scianek na kazda konczyne, kopiowanych osobno
  assert.equal(LEGACY_COPIES.length, 12, 'szesc scianek nogi i szesc reki')

  const leftLeg = { x: 16, y: 48, w: 16, h: 16 }
  const leftArm = { x: 32, y: 48, w: 16, h: 16 }
  const covers = (region) => {
    const grid = new Set()
    for (const c of LEGACY_COPIES) {
      if (c.to[0] < region.x || c.to[0] >= region.x + region.w) continue
      for (let y = c.to[1]; y < c.to[1] + c.from.h; y++) {
        for (let x = c.to[0]; x < c.to[0] + c.from.w; x++) grid.add(`${x},${y}`)
      }
    }
    return grid
  }

  for (const [label, region, srcX] of [['noga', leftLeg, 0], ['reka', leftArm, 40]]) {
    const painted = covers(region)

    // pas 16x16 minus dwa puste rogi w gornym rzedzie = 224 piksele
    assert.equal(painted.size, 16 * 16 - 2 * (4 * 4), `${label}: zla liczba zamalowanych pikseli`)

    for (const key of painted) {
      const [x, y] = key.split(',').map(Number)
      assert.ok(
        x >= region.x && x < region.x + region.w && y >= region.y && y < region.y + region.h,
        `${label}: piksel ${key} poza regionem`
      )
    }

    const sources = LEGACY_COPIES.filter(c => c.from.x >= srcX && c.from.x < srcX + 16)
    assert.equal(sources.length, 6, `${label}: kazda scianka ma miec swoja kopie`)
    for (const c of sources) {
      assert.ok(c.from.y >= 16 && c.from.y + c.from.h <= 32, `${label}: zrodlo poza pasem konczyny`)
    }
  }

  // boki musza sie zamieniac miejscami, inaczej konczyna wyjdzie odwrocona
  const legRight = LEGACY_COPIES.find(c => c.from.x === 0 && c.from.y === 20)
  const legLeft = LEGACY_COPIES.find(c => c.from.x === 8 && c.from.y === 20)
  assert.equal(legRight.to[0], 24, 'prawy bok idzie w slot lewego')
  assert.equal(legLeft.to[0], 16, 'lewy bok idzie w slot prawego')

  // przod i tyl zostaja na swoich slotach
  const legFront = LEGACY_COPIES.find(c => c.from.x === 4 && c.from.y === 20)
  const legBack = LEGACY_COPIES.find(c => c.from.x === 12 && c.from.y === 20)
  assert.equal(legFront.to[0] - 16, legFront.from.x, 'przod zostaje w swoim slocie')
  assert.equal(legBack.to[0] - 16, legBack.from.x, 'tyl zostaje w swoim slocie')

  // gora nie moze zamienic sie z dolem
  const legTop = LEGACY_COPIES.find(c => c.from.x === 4 && c.from.y === 16)
  const legBottom = LEGACY_COPIES.find(c => c.from.x === 8 && c.from.y === 16)
  assert.equal(legTop.to[0] - 16, legTop.from.x, 'gora zostaje w swoim slocie')
  assert.equal(legBottom.to[0] - 16, legBottom.from.x, 'dol zostaje w swoim slocie')

  for (const copy of LEGACY_COPIES) {
    assert.ok(copy.from.y + copy.from.h <= 32, 'zrodlo musi lezec w gornej polowie')
    assert.ok(copy.to[1] >= 32, 'cel musi lezec w dolnej polowie')
    assert.ok(inside({ x: copy.to[0], y: copy.to[1], w: copy.from.w, h: copy.from.h }))
  }
}

// stary skin z kryjaca czernia zamiast alfy w kapeluszu (przypadek Notcha)
{
  const fill = (alpha, rgb = 0) => {
    const data = new Uint8ClampedArray(SKIN_SIZE * SKIN_SIZE * 4)
    const { x, y, w, h } = LEGACY_HAT
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        const o = (py * SKIN_SIZE + px) * 4
        data[o] = data[o + 1] = data[o + 2] = rgb
        data[o + 3] = alpha
      }
    }
    return data
  }

  const alphaAt = (data, x, y) => data[(y * SKIN_SIZE + x) * 4 + 3]

  // caly region kryjacy -> alfa zerowana
  const opaque = fill(255)
  assert.equal(stripLegacyHat(opaque, SKIN_SIZE), true, 'kryjacy kapelusz ma byc wyczyszczony')
  assert.equal(alphaAt(opaque, 32, 0), 0)
  assert.equal(alphaAt(opaque, 63, 15), 0)

  // ale kolor zostaje nietkniety, zerujemy tylko alfe
  const coloured = fill(255, 200)
  stripLegacyHat(coloured, SKIN_SIZE)
  assert.equal(coloured[(0 * SKIN_SIZE + 32) * 4], 200, 'kanaly koloru maja zostac')

  // skin z prawdziwa alfa w kapeluszu zostaje bez zmian
  const withAlpha = fill(255)
  withAlpha[(5 * SKIN_SIZE + 40) * 4 + 3] = 0
  assert.equal(stripLegacyHat(withAlpha, SKIN_SIZE), false, 'kapelusz z alfa ma zostac')
  assert.equal(alphaAt(withAlpha, 32, 0), 255, 'nic nie moze zostac wyzerowane')

  // nie ruszamy nic poza regionem kapelusza
  const outside = fill(255)
  const probe = (10 * SKIN_SIZE + 10) * 4 + 3
  outside[probe] = 255
  stripLegacyHat(outside, SKIN_SIZE)
  assert.equal(outside[probe], 255, 'twarz nie moze stracic alfy')

  assert.deepEqual(LEGACY_HAT, { x: 32, y: 0, w: 32, h: 16 })
}

// wycinek glowy pokrywa twarz i warstwe kapelusza
{
  assert.deepEqual(HEAD_CROP, { x: 8, y: 8, w: 8, h: 8 })
  assert.deepEqual(HEAD_OVERLAY_CROP, { x: 40, y: 8, w: 8, h: 8 })
  assert.equal(HEAD_CROP.w, HEAD_OVERLAY_CROP.w, 'oba wycinki maja ten sam rozmiar')

  const face = boxFaces(0, 0, 8, 8, 8)[4]
  assert.deepEqual(HEAD_CROP, face, 'wycinek glowy ma sie zgadzac ze scianka twarzy')
}

// rozpoznawanie zalozonej peleryny sposrod posiadanych
{
  const hash = '9e507afc56359978a3eb3e32367042b853cddd0995d17d0da995662913fb00f7'
  const url = capeTextureUrl(hash)

  assert.equal(url, `https://textures.minecraft.net/texture/${hash}`)
  assert.equal(isEquipped(hash, url), true, 'ta sama tekstura to ta zalozona')
  assert.equal(isEquipped('0'.repeat(64), url), false, 'inny hash to inna peleryna')
  assert.equal(isEquipped(hash, null), false, 'brak zalozonej peleryny')
  assert.equal(isEquipped(hash, ''), false)
}

// jeden gracz ma miec jeden adres, bo odpowiedzi sa cache'owane w przegladarce
{
  assert.equal(normaliseQuery('Notch'), 'notch')
  assert.equal(normaliseQuery('notch'), 'notch')
  assert.equal(normaliseQuery('  NOTCH  '), 'notch')
  assert.equal(
    normaliseQuery('069a79f4-44e9-4726-a5be-fca90e38aaf5'),
    '069a79f444e94726a5befca90e38aaf5',
    'uuid z myslnikami ma trafiac tam co bez'
  )
  assert.equal(
    normaliseQuery('069A79F444E94726A5BEFCA90E38AAF5'),
    '069a79f444e94726a5befca90e38aaf5'
  )
  // nick z myslnikiem nie istnieje, ale gdyby przyszedl, nie wolno go okroic
  assert.equal(normaliseQuery('a-b'), 'a-b')
}

// nazwa pliku nie przemyci sciezki
{
  assert.equal(skinFileName('Notch', 'skin'), 'Notch-skin.png')
  assert.equal(skinFileName('../../etc/passwd', 'head'), 'etcpasswd-head.png')
  assert.equal(skinFileName('', 'skin'), 'skin-skin.png')
  assert.ok(!skinFileName('a/b\\c', 'x').includes('/'))
}

// warstwa zewnetrzna musi odstawac, inaczej migocze na modelu
{
  assert.ok(OVERLAY_INFLATE > 0 && OVERLAY_INFLATE < 1, 'powiekszenie ma byc ulamkiem piksela')
}

// narzedzie jest wlaczone i opisane w obu jezykach
{
  const tool = TOOLS.find(t => t.id === 'skin-stealer')
  assert.ok(tool && tool.live === true, 'narzedzie ma byc live')
  assert.equal(tool.cat, 'skin')

  for (const [loc, dict] of [['en', en], ['pl', pl]]) {
    const s = dict.skinStealer
    assert.ok(s, `${loc}: brak sekcji skinStealer`)
    assert.ok(dict.tools['skin-stealer'], `${loc}: brak opisu na kafelku`)
    for (const source of CAPE_SOURCES) {
      assert.ok(s.sources[source], `${loc}: brak nazwy zrodla ${source}`)
    }
    for (const model of ['classic', 'slim']) {
      assert.ok(s.models[model], `${loc}: brak nazwy modelu ${model}`)
    }
    assert.equal(s.features.length, 3, `${loc}: features`)
    assert.ok(s.faq.length >= 5, `${loc}: za malo pytan`)
  }
}

console.log('skin: ok')
