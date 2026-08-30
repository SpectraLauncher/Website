// node --experimental-strip-types test/curseforge-proxy-check.mjs
import assert from 'node:assert/strict'
import { allowedCurseforge } from '../server/utils/curseforge.ts'

const ok = (method, path) =>
  assert.ok(allowedCurseforge(method, path.split('/').filter(Boolean)),
    `powinno przejsc: ${method} ${path}`)

const no = (method, path) =>
  assert.ok(!allowedCurseforge(method, path.split('/').filter(Boolean)),
    `powinno odpasc: ${method} ${path}`)

// dokladnie to, czego uzywa launcher
ok('GET', 'categories')
ok('GET', 'mods/search')
ok('GET', 'mods/238222')
ok('GET', 'mods/238222/description')
ok('GET', 'mods/238222/files')
ok('GET', 'mods/238222/files/4901234')
ok('POST', 'fingerprints')
ok('POST', 'mods')
ok('POST', 'mods/files')

// wszystko inne to nie nasza sprawa
no('GET', 'mods')                    // bulk tylko POST-em
no('GET', 'minecraft/version')
no('GET', 'games')
no('POST', 'categories')
no('DELETE', 'mods/238222')
no('PATCH', 'mods/238222')

// identyfikatory musza byc liczbami — inaczej sciezka jest tunelem
no('GET', 'mods/../../games')
no('GET', 'mods/search/../categories')
no('GET', 'mods/abc')
no('GET', 'mods/238222/files/abc')
no('GET', 'mods/238222/changelog')
no('GET', '')

console.log('✓ proxy CurseForge: przechodzi 9 sciezek launchera, reszta 404')
