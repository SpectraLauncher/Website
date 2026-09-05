import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { readArchiveInfo } from '../../server/utils/mod-manifest'
import { parseYaml, yamlList, yamlString } from '../../server/utils/yaml'

const read = (name: string) => readArchiveInfo(readFileSync(`test/fixtures/${name}`))

const bukkit = read('sample-plugin.jar')
const velocity = read('sample-velocity-plugin.jar')

describe('deskryptor pluginu', () => {
  it('rozpoznaje plugin, a nie moda', () => {
    expect(bukkit.kind).toBe('plugin')
    expect(velocity.kind).toBe('plugin')
  })

  it('czyta nazwe, wersje i autorow z plugin.yml', () => {
    expect(bukkit.name).toBe('SpectraGuard')
    expect(bukkit.version).toBe('2.4.1')
    expect(bukkit.authors).toEqual(['Alice', 'Bob'])
    expect(bukkit.links.homepage).toBe('https://usespectra.app')
  })

  // Purpur forkuje Papera, Paper forkuje Spigota, Spigot forkuje Bukkita, wiec
  // jar zbudowany pod przodka dziala na forkach.
  it('jeden deskryptor daje cala rodzine platform', () => {
    expect(bukkit.loaders).toContain('bukkit')
    expect(bukkit.loaders).toContain('spigot')
    expect(bukkit.loaders).toContain('paper')
    expect(bukkit.loaders).toContain('purpur')
  })

  // Folia rozklada swiat na watki regionow i przyjmuje wylacznie plugin, ktory
  // sam deklaruje, ze jest na to przygotowany.
  it('folia dochodzi tylko przy jawnej deklaracji', () => {
    expect(bukkit.loaders).toContain('folia')
    const withoutFolia = parseYaml('name: X\nversion: 1.0\n')
    expect(withoutFolia['folia-supported']).toBeUndefined()
  })

  it('velocity czyta sie z jsona i nie udaje bukkita', () => {
    expect(velocity.loaders).toEqual(['velocity'])
    expect(velocity.modId).toBe('spectraproxy')
    expect(velocity.name).toBe('Spectra Proxy')
  })

  it('plugin jest serwerowy', () => {
    expect(bukkit.environment).toBe('server')
    expect(velocity.environment).toBe('server')
  })
})

describe('parseYaml', () => {
  const doc = parseYaml(readFileSync('test/fixtures/sample-plugin.jar').length
    ? 'name: X\nversion: 1.0\nlist: [a, b]\nblock:\n  - one\n  - two\nnested:\n  key: value\n'
    : '')

  it('czyta skalary, listy inline i blokowe', () => {
    expect(doc.name).toBe('X')
    expect(doc.list).toEqual(['a', 'b'])
    expect(doc.block).toEqual(['one', 'two'])
  })

  it('czyta zagniezdzona mape', () => {
    expect(doc.nested).toEqual({ key: 'value' })
  })

  it('rozpoznaje wartosci logiczne w obu zapisach', () => {
    const flags = parseYaml('a: true\nb: yes\nc: false\nd: no\n')
    expect(flags.a).toBe(true)
    expect(flags.b).toBe(true)
    expect(flags.c).toBe(false)
    expect(flags.d).toBe(false)
  })

  it('pomija komentarze i puste linie', () => {
    expect(parseYaml('# komentarz\n\nklucz: wartosc\n').klucz).toBe('wartosc')
  })

  it('zdejmuje cudzyslowy, bo api-version bywa zapisana jako tekst', () => {
    expect(parseYaml("api-version: '1.20'\n")['api-version']).toBe('1.20')
  })

  it('pomocnicze odczyty nie wywalaja sie na braku pola', () => {
    expect(yamlString(undefined)).toBeNull()
    expect(yamlList(undefined)).toEqual([])
    expect(yamlList('solo')).toEqual(['solo'])
  })
})
