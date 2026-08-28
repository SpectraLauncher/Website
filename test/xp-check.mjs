// node --experimental-strip-types test/xp-check.mjs
import assert from 'node:assert/strict'
import {
  totalXpForLevel, xpToNextLevel, levelFromXp, xpBetweenLevels, bottlesFor, XP_SOURCES
} from '../app/utils/xp.ts'

// znane wartosci z gry
assert.equal(totalXpForLevel(0), 0)
assert.equal(totalXpForLevel(1), 7)
assert.equal(totalXpForLevel(16), 352)
assert.equal(totalXpForLevel(17), 394)
assert.equal(totalXpForLevel(30), 1395)
assert.equal(totalXpForLevel(31), 1507)
assert.equal(totalXpForLevel(32), 1628)
assert.equal(totalXpForLevel(50), 5345)

// koszt kolejnego poziomu
assert.equal(xpToNextLevel(0), 7)
assert.equal(xpToNextLevel(15), 37)
assert.equal(xpToNextLevel(16), 42)
assert.equal(xpToNextLevel(30), 112)
assert.equal(xpToNextLevel(31), 121)

// obie funkcje musza sie zgadzac na kazdym progu — tu wychodza bledy w wielomianach
for (let n = 0; n < 120; n++) {
  assert.equal(
    totalXpForLevel(n) + xpToNextLevel(n),
    totalXpForLevel(n + 1),
    `nieciaglosc miedzy poziomem ${n} a ${n + 1}`
  )
}

// z punktow na poziom
assert.deepEqual(levelFromXp(0), { level: 0, intoLevel: 0, toNext: 7, progress: 0 })
assert.equal(levelFromXp(7).level, 1)
assert.equal(levelFromXp(6).level, 0)
assert.equal(levelFromXp(1395).level, 30)
assert.equal(levelFromXp(1394).level, 29)

// w obie strony
for (const lvl of [1, 5, 16, 17, 30, 31, 32, 60, 100]) {
  const total = totalXpForLevel(lvl)
  const back = levelFromXp(total)
  assert.equal(back.level, lvl, `poziom ${lvl} tam i z powrotem`)
  assert.equal(back.intoLevel, 0, `poziom ${lvl} bez reszty`)
}

// od poziomu do poziomu
assert.equal(xpBetweenLevels(0, 30), 1395)
assert.equal(xpBetweenLevels(30, 0), 0, 'w dol nie kosztuje nic')
assert.equal(xpBetweenLevels(29, 30), xpToNextLevel(29))

// butelki: najlepszy przypadek nie moze potrzebowac wiecej niz najgorszy
{
  const b = bottlesFor(1395)
  assert.ok(b.best <= b.average && b.average <= b.worst)
  assert.equal(b.average, Math.ceil(1395 / 7))
  assert.equal(b.best, Math.ceil(1395 / 11))
  assert.equal(b.worst, Math.ceil(1395 / 3))
}

// zrodla xp
assert.ok(XP_SOURCES.length > 20)
for (const s of XP_SOURCES) {
  assert.ok(s.min <= s.max, `zakres ${s.key}`)
  assert.ok(s.min >= 0, `ujemne xp w ${s.key}`)
}
assert.equal(new Set(XP_SOURCES.map(s => s.key)).size, XP_SOURCES.length, 'unikalne klucze')

console.log('ok — xp')
