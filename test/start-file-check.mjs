// node --experimental-strip-types test/start-file-check.mjs
import assert from 'node:assert/strict'
import {
  flagsFor, javaCommand, buildScript, scriptName, estimateRam,
  MAX_PLAYERS, MAX_MODS, AIKAR_EXTREME_MIN_GB, VECTOR_FLAG, ZGENERATIONAL_FLAG
} from '../app/utils/startFile.ts'

const opts = (over = {}) => ({
  jar: 'server.jar', ramGb: 4, preset: 'aikar', os: 'unix', gui: false, restart: false, ...over
})

// bez presetu zostaje sama pamiec
assert.deepEqual(flagsFor('none'), [])
assert.equal(javaCommand(opts({ preset: 'none' })), 'java -Xms4096M -Xmx4096M -jar server.jar --nogui')

// pamiec w megabajtach, bo ulamki gigabajtow JVM odrzuca
assert.ok(javaCommand(opts({ ramGb: 2.5 })).startsWith('java -Xms2560M -Xmx2560M'))
assert.ok(javaCommand(opts({ ramGb: 0.1 })).startsWith('java -Xms512M -Xmx512M'), 'dolny prog 512M')

// Xms i Xmx zawsze rowne — inaczej JVM zmienia rozmiar sterty w trakcie gry
{
  const cmd = javaCommand(opts({ ramGb: 6 }))
  const xms = cmd.match(/-Xms(\d+)M/)[1]
  const xmx = cmd.match(/-Xmx(\d+)M/)[1]
  assert.equal(xms, xmx)
}

// oba warianty Aikara maja te same flagi wspolne i rozne strojenie G1
{
  const small = flagsFor('aikar')
  const large = flagsFor('aikar_extreme')
  assert.equal(small.length, large.length)
  assert.ok(small.includes('-XX:G1HeapRegionSize=8M'))
  assert.ok(large.includes('-XX:G1HeapRegionSize=16M'))
  assert.ok(small.includes('-XX:InitiatingHeapOccupancyPercent=15'))
  assert.ok(large.includes('-XX:InitiatingHeapOccupancyPercent=20'))
  for (const f of ['-XX:+UseG1GC', '-XX:MaxGCPauseMillis=200', '-Daikars.new.flags=true']) {
    assert.ok(small.includes(f) && large.includes(f), `wspolna flaga ${f}`)
  }
  assert.equal(new Set(small).size, small.length, 'zadna flaga nie powtarza sie')
}

// modul Vector to jedyna flaga zalezna od JVM-a — da sie ja zdjac
{
  assert.ok(flagsFor('aikar').includes(VECTOR_FLAG))
  assert.ok(!flagsFor('aikar', false).includes(VECTOR_FLAG))
  assert.equal(flagsFor('aikar', false).length, flagsFor('aikar').length - 1)
  assert.ok(!flagsFor('proxy').includes(VECTOR_FLAG), 'proxy nie uzywa Vector API')
  assert.ok(!javaCommand(opts({ vector: false })).includes('incubator'))
}

// zestaw Aikara nie zawiera flag usunietych w Javie 21
{
  const removed = ['-XX:G1ConcRSHotCardLimit', '-XX:G1ConcRefinementServiceIntervalMillis', '-XX:+AggressiveOpts']
  for (const preset of ['aikar', 'aikar_extreme', 'zgc', 'proxy']) {
    for (const flag of removed) {
      assert.ok(!flagsFor(preset).some(f => f.startsWith(flag)), `${preset} zawiera usunieta flage ${flag}`)
    }
  }
}

// G1 nie znika w Javie 21 — zestaw Aikara nadal go wlacza
assert.ok(flagsFor('aikar').includes('-XX:+UseG1GC'))
assert.ok(flagsFor('aikar_extreme').includes('-XX:+UseG1GC'))

// ZGC: tryb generacyjny jawny do Javy 22, domyslny od 23
{
  const j21 = flagsFor('zgc', false, 21)
  const j23 = flagsFor('zgc', false, 23)
  assert.ok(j21.includes('-XX:+UseZGC') && j23.includes('-XX:+UseZGC'))
  assert.ok(j21.includes(ZGENERATIONAL_FLAG), 'Java 21 potrzebuje jawnej flagi')
  assert.ok(!j23.includes(ZGENERATIONAL_FLAG), 'od Javy 23 flaga tylko ostrzega')
  assert.equal(j23.length, j21.length - 1)
  assert.ok(!j21.includes('-XX:+UseG1GC'), 'dwa kolektory naraz sie wykluczaja')
}

// proxy nie dostaje flag Aikara
{
  const p = flagsFor('proxy')
  assert.ok(p.includes('-XX:G1HeapRegionSize=4M'))
  assert.ok(!p.some(f => f.includes('aikars')))
}

// GUI: --nogui znika dopiero po wlaczeniu okna
assert.ok(javaCommand(opts({ gui: false })).endsWith('--nogui'))
assert.ok(!javaCommand(opts({ gui: true })).includes('nogui'))

// nazwa jara przechodzi, pusta wraca do domyslnej
assert.ok(javaCommand(opts({ jar: 'paper-1.21.jar' })).includes('-jar paper-1.21.jar'))
assert.ok(javaCommand(opts({ jar: '   ' })).includes('-jar server.jar'))

// skrypty
{
  const bat = buildScript(opts({ os: 'windows' }))
  assert.ok(bat.startsWith('@echo off'))
  assert.ok(bat.includes('pause'))
  assert.ok(!bat.includes('goto start'))

  const batLoop = buildScript(opts({ os: 'windows', restart: true }))
  assert.ok(batLoop.includes(':start') && batLoop.includes('goto start'))
  assert.ok(!batLoop.includes('pause'), 'petla nie potrzebuje pause')

  const sh = buildScript(opts({ os: 'unix' }))
  assert.ok(sh.startsWith('#!/bin/bash'))
  assert.ok(!sh.includes('while true'))

  const shLoop = buildScript(opts({ os: 'unix', restart: true }))
  assert.ok(shLoop.includes('while true; do') && shLoop.includes('done'))
  assert.ok(shLoop.includes('sleep 5'))
}

assert.equal(scriptName('windows'), 'start.bat')
assert.equal(scriptName('unix'), 'start.sh')

// szacowanie pamieci rosnie z obu suwakow i nie wychodzi poza zakres
{
  assert.ok(estimateRam(0, 0) >= 1)
  assert.ok(estimateRam(20, 0) > estimateRam(10, 0), 'wiecej graczy = wiecej ramu')
  assert.ok(estimateRam(10, 20) > estimateRam(10, 0), 'wiecej modow = wiecej ramu')
  assert.ok(estimateRam(10, 10) > estimateRam(10, 5), 'mod wazy wiecej niz gracz')

  // wartosci poza suwakiem sa przycinane, nie ekstrapolowane
  assert.equal(estimateRam(999, 999), estimateRam(MAX_PLAYERS, MAX_MODS))
  assert.equal(estimateRam(-5, -5), estimateRam(0, 0))

  // zawsze pelne pol giga, nigdy 3.7734
  for (const [p, m] of [[0, 0], [37, 13], [100, 50], [7, 41]]) {
    assert.equal(estimateRam(p, m) * 2 % 1, 0, `zaokraglenie dla ${p}/${m}`)
  }

  // punkty odniesienia z praktyki
  assert.equal(estimateRam(0, 0), 2, 'pusty serwer')
  assert.equal(estimateRam(50, 0), 8, '50 graczy')
  assert.equal(estimateRam(100, 0), 14, '100 graczy')

  // pelny serwer przekracza prog, przy ktorym Aikar zaleca wariant extreme
  assert.ok(estimateRam(MAX_PLAYERS, 0) >= AIKAR_EXTREME_MIN_GB)
  assert.ok(estimateRam(MAX_PLAYERS, MAX_MODS) > estimateRam(MAX_PLAYERS, 0))
}

console.log('ok — start file')
