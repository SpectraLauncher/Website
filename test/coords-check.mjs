// node --experimental-strip-types test/coords-check.mjs
import assert from 'node:assert/strict'
import { toNether, toOverworld, distances, chunkInfo, tpCommand } from '../app/utils/coords.ts'

// Y nie jest skalowane
assert.deepEqual(toNether({ x: 1000, y: 64, z: -800 }), { x: 125, y: 64, z: -100 })
assert.deepEqual(toOverworld({ x: 125, y: 64, z: -100 }), { x: 1000, y: 64, z: -800 })

// zaokraglanie w dol, nie ku zeru — inaczej ujemne wyszlyby o blok obok
assert.deepEqual(toNether({ x: -1, y: 0, z: -9 }), { x: -1, y: 0, z: -2 })
assert.deepEqual(toNether({ x: 7, y: 0, z: 8 }), { x: 0, y: 0, z: 1 })

// dystanse
{
  const d = distances({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })
  assert.equal(d.d2, 3)
  assert.equal(d.d3, 5)
  assert.deepEqual([d.dx, d.dy, d.dz], [3, 4, 0])
}
{
  const d = distances({ x: 10, y: 70, z: 10 }, { x: 10, y: 70, z: 10 })
  assert.equal(d.d3, 0)
}

// chunki i regiony
{
  const c = chunkInfo({ x: 0, y: 64, z: 0 })
  assert.deepEqual([c.chunkX, c.chunkZ], [0, 0])
  assert.deepEqual([c.inChunkX, c.inChunkZ], [0, 0])
  assert.equal(c.regionFile, 'r.0.0.mca')
}
{
  const c = chunkInfo({ x: 35, y: 64, z: 17 })
  assert.deepEqual([c.chunkX, c.chunkZ], [2, 1])
  assert.deepEqual([c.inChunkX, c.inChunkZ], [3, 1])
  assert.deepEqual([c.chunkMinX, c.chunkMinZ], [32, 16])
}
{
  // ujemne: -1 nalezy do chunka -1, a nie 0
  const c = chunkInfo({ x: -1, y: 64, z: -1 })
  assert.deepEqual([c.chunkX, c.chunkZ], [-1, -1])
  assert.deepEqual([c.inChunkX, c.inChunkZ], [15, 15], 'pozycja w chunku zawsze 0-15')
  assert.equal(c.regionFile, 'r.-1.-1.mca')
}
{
  // granica regionu: chunk 32 to juz region 1
  assert.equal(chunkInfo({ x: 511, y: 0, z: 0 }).regionFile, 'r.0.0.mca')
  assert.equal(chunkInfo({ x: 512, y: 0, z: 0 }).regionFile, 'r.1.0.mca')
  assert.equal(chunkInfo({ x: -1, y: 0, z: 0 }).regionFile, 'r.-1.0.mca')
}
{
  // indeks chunka w regionie zawsze 0-1023
  for (const x of [-1000, -33, -1, 0, 17, 600]) {
    const c = chunkInfo({ x, y: 0, z: x })
    assert.ok(c.chunkInRegion >= 0 && c.chunkInRegion < 1024, `indeks dla ${x}`)
  }
}

assert.equal(tpCommand({ x: 125, y: 64, z: -94 }), '/tp @s 125 64 -94')
assert.equal(tpCommand({ x: 0, y: 0, z: 0 }, '@p'), '/tp @p 0 0 0')

console.log('ok — coords')
