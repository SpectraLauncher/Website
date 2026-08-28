// node --experimental-strip-types test/circle-gen-check.mjs
import assert from 'node:assert/strict'
import { buildLayer, totalBlocks, layerCount, dimensions } from '../app/utils/circleGen.ts'

const opts = (over = {}) => ({ shape: 'circle', width: 9, height: 9, style: 'thin', ...over })

const rows = layer => layer.cells.map(r => r.map(c => (c ? '#' : '.')).join(''))

// wypelnione kolo: siatka ma zadany rozmiar i jest symetryczna w obu osiach
{
  for (const d of [5, 6, 7, 8, 15, 16]) {
    const l = buildLayer(opts({ width: d, height: d, style: 'filled' }))
    assert.equal(l.cells.length, d, `wysokosc siatki dla ${d}`)
    assert.equal(l.cells[0].length, d, `szerokosc siatki dla ${d}`)

    const r = rows(l)
    for (let i = 0; i < d; i++) {
      assert.equal(r[i], r[d - 1 - i], `symetria pionowa, srednica ${d}`)
      assert.equal(r[i], [...r[i]].reverse().join(''), `symetria pozioma, srednica ${d}`)
    }
  }
}

// obrys jest podzbiorem wypelnienia, a gruby zawiera cienki
{
  const filled = buildLayer(opts({ style: 'filled' })).cells
  const thin = buildLayer(opts({ style: 'thin' })).cells
  const thick = buildLayer(opts({ style: 'thick' })).cells

  for (let z = 0; z < filled.length; z++) {
    for (let x = 0; x < filled[z].length; x++) {
      if (thin[z][x]) assert.ok(filled[z][x], `cienki obrys poza wypelnieniem ${x},${z}`)
      if (thin[z][x]) assert.ok(thick[z][x], `gruby obrys nie zawiera cienkiego ${x},${z}`)
    }
  }
  assert.ok(buildLayer(opts({ style: 'thick' })).count > buildLayer(opts({ style: 'thin' })).count)
  assert.ok(buildLayer(opts({ style: 'filled' })).count > buildLayer(opts({ style: 'thick' })).count)
}

// obrys nie ma dziur: kazdy wiersz przecinajacy ksztalt ma dokladnie 2 konce
{
  const l = buildLayer(opts({ width: 21, height: 21, style: 'thin' }))
  for (const row of rows(l)) {
    if (!row.includes('#')) continue
    assert.equal(row.indexOf('#'), row.length - 1 - row.lastIndexOf('#'), 'obrys niesymetryczny w wierszu')
  }
}

// elipsa: osie niezalezne
{
  const l = buildLayer(opts({ shape: 'ellipse', width: 21, height: 9, style: 'filled' }))
  assert.equal(l.cells.length, 9)
  assert.equal(l.cells[0].length, 21)
  assert.ok(rows(l)[4].split('#').length - 1 > rows(l)[0].split('#').length - 1, 'srodek szerszy niz brzeg')
}

// kula: warstwy skrajne wezsze od rownikowej, suma warstw = laczna liczba blokow
{
  const o = opts({ shape: 'sphere', width: 15, height: 15, style: 'filled' })
  assert.equal(layerCount(o), 15)

  const mid = buildLayer(o, 7).count
  const edge = buildLayer(o, 0).count
  assert.ok(edge < mid, 'warstwa skrajna musi byc mniejsza od rownikowej')

  let sum = 0
  for (let i = 0; i < 15; i++) sum += buildLayer(o, i).count
  assert.equal(totalBlocks(o), sum)

  // symetria pionowa kuli
  for (let i = 0; i < 7; i++) {
    assert.equal(buildLayer(o, i).count, buildLayer(o, 14 - i).count, `warstwy ${i} i ${14 - i}`)
  }
}

// pusta kula ma mniej blokow niz pelna, ale wiecej niz zero
{
  const solid = totalBlocks(opts({ shape: 'sphere', width: 15, height: 15, style: 'filled' }))
  const hollow = totalBlocks(opts({ shape: 'sphere', width: 15, height: 15, style: 'thin' }))
  assert.ok(hollow > 0 && hollow < solid)
}

// kolo i elipsa maja jedna warstwe
assert.equal(layerCount(opts()), 1)
assert.deepEqual(dimensions(opts({ shape: 'sphere', width: 9, height: 5 })), { width: 9, height: 5, depth: 9 })
assert.deepEqual(dimensions(opts({ shape: 'ellipse', width: 9, height: 5 })), { width: 9, height: 1, depth: 5 })

// skrajnie male rozmiary nie wysypuja generatora
for (const d of [1, 2, 3]) {
  assert.ok(buildLayer(opts({ width: d, height: d, style: 'thin' })).count >= 1, `srednica ${d}`)
}

console.log('ok — circle generator')
