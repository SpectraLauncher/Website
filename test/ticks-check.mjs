// node --experimental-strip-types test/ticks-check.mjs
import assert from 'node:assert/strict'
import {
  TICKS_PER_DAY, ticksToSeconds, ticksToDuration, durationToTicks, mcDays,
  dayTick, tickToClock, clockToTick, phaseAt, canSleep, mobsSpawn,
  TIME_PRESETS, perDay, REAL_SECONDS_PER_DAY
} from '../app/utils/ticks.ts'

// podstawy
assert.equal(ticksToSeconds(20), 1)
assert.equal(REAL_SECONDS_PER_DAY, 1200, 'doba to 20 realnych minut')
assert.equal(mcDays(TICKS_PER_DAY), 1)

// czas trwania w obie strony
assert.deepEqual(ticksToDuration(20), { days: 0, hours: 0, minutes: 0, seconds: 1 })
assert.deepEqual(ticksToDuration(24_000), { days: 0, hours: 0, minutes: 20, seconds: 0 })
assert.equal(durationToTicks({ minutes: 20 }), 24_000)
assert.equal(durationToTicks({ hours: 1 }), 72_000)
for (const t of [0, 20, 1234, 24_000, 500_000]) {
  assert.equal(durationToTicks(ticksToDuration(t)), Math.floor(t / 20) * 20, `tam i z powrotem ${t}`)
}

// pozycja w dobie zawsze 0-23999
assert.equal(dayTick(0), 0)
assert.equal(dayTick(24_000), 0)
assert.equal(dayTick(25_000), 1_000)
assert.equal(dayTick(-1_000), 23_000, 'ujemne tez musza wpasc w zakres')

// zegar: tick 0 to szosta rano
assert.equal(tickToClock(0).label, '06:00')
assert.equal(tickToClock(6_000).label, '12:00', 'poludnie')
assert.equal(tickToClock(12_000).label, '18:00', 'zachod')
assert.equal(tickToClock(18_000).label, '00:00', 'polnoc')
assert.equal(tickToClock(24_000).label, '06:00', 'pelna doba wraca na start')

// zegar w druga strone
for (const [h, m] of [[6, 0], [12, 0], [18, 0], [0, 0], [9, 30]]) {
  const back = tickToClock(clockToTick(h, m))
  assert.equal(back.label, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, `${h}:${m}`)
}

// fazy doby pokrywaja cala dobe bez dziur i bez zakladek
{
  for (let t = 0; t < TICKS_PER_DAY; t += 137) {
    assert.ok(phaseAt(t), `brak fazy dla ticku ${t}`)
  }
  assert.equal(phaseAt(0).key, 'day')
  assert.equal(phaseAt(12_500).key, 'sunset')
  assert.equal(phaseAt(13_000).key, 'night')
  assert.equal(phaseAt(23_500).key, 'sunrise')
}

// spanie zaczyna sie wczesniej niz spawn mobow — to nie ta sama granica
assert.ok(!canSleep(12_000))
assert.ok(canSleep(12_542))
assert.ok(canSleep(13_000))
assert.ok(!canSleep(23_460))
assert.ok(!mobsSpawn(12_542), 'o 12542 juz spisz, ale moby jeszcze nie spawnuja')
assert.ok(mobsSpawn(13_000))
assert.ok(!mobsSpawn(23_000))

// presety wskazuja na wlasciwe fazy
assert.equal(phaseAt(TIME_PRESETS.find(p => p.key === 'noon').ticks).key, 'day')
assert.equal(phaseAt(TIME_PRESETS.find(p => p.key === 'midnight').ticks).key, 'night')
for (const p of TIME_PRESETS) {
  assert.ok(p.ticks >= 0 && p.ticks < TICKS_PER_DAY, `preset ${p.key} poza doba`)
}

assert.equal(perDay(24_000), 1)
assert.equal(perDay(1_200), 20)
assert.equal(perDay(0), 0, 'zero nie moze dzielic')

console.log('ok — ticks')
