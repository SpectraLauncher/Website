import { existsSync, readFileSync } from 'node:fs'

// The parsers are tested against real mods, plugins, packs and schematics, as
// CLAUDE.md asks. Those files are tens of megabytes of other people's binaries,
// so they do not live in the repository — a clone without them skips the suites
// that need them instead of failing.
//
// test/fixtures/README.md says what each file is and where to get it.
const DIR = 'test/fixtures'

export function fixture(name: string): Buffer {
  return readFileSync(`${DIR}/${name}`)
}

export function hasFixtures(...names: string[]): boolean {
  return names.every(name => existsSync(`${DIR}/${name}`))
}
