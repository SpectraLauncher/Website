import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { canModerate, isAdmin, isOwner } from '../../shared/utils/staff-roles'

const read = (file: string) => readFileSync(file, 'utf8')
const slash = (file: string) => file.split(sep).join('/')

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory()
    ? walk(join(dir, entry.name))
    : [join(dir, entry.name)]))
}

/**
 * Two different kinds of authority, and folding them together breaks things in
 * both directions.
 *
 * Running the site (owner / admin / moderator) is not the same as having rights
 * on one project or one organization (member permissions). A moderator needs to
 * READ everything they judge and must not be able to EDIT any of it; a project
 * owner may edit their own project and has no say over anybody else's.
 */
describe('czytanie tego, co sie moderuje', () => {
  const CASES: Array<[string, string]> = [
    ['server/utils/catalog-gate.ts', 'requireCatalogRead'],
    ['server/utils/catalog-public.ts', 'visibleProject'],
    ['server/utils/project-notify.ts', 'canSeeThread'],
    ['server/utils/reports.ts', 'reportForViewer'],
  ]

  it.each(CASES)('%s pyta o moderatora, nie o admina', (file) => {
    const source = read(file)

    expect(source).toMatch(/canModerate\(/)
    // isAdmin here would shut the moderator out of their own queue: the rows
    // would list and every one of them would answer 404.
    expect(source).not.toMatch(/\bisAdmin\(/)
  })
})

describe('edytowanie cudzego projektu', () => {
  // The other direction. Deciding yes or no is not the same as rewriting the
  // thing, and a moderator gets no rights on content they did not author.
  it('prawa do projektu wymagaja admina, nie moderatora', () => {
    const source = read('server/utils/project-rights.ts')

    expect(source).toMatch(/if \(isAdmin\(user\)\) \{/)
    expect(source).not.toMatch(/canModerate\(/)
  })

  it('standing w organizacji tez', () => {
    const source = read('server/utils/organization.ts')

    expect(source).toMatch(/isAdmin\(user\)/)
    expect(source).not.toMatch(/canModerate\(/)
  })

  it('prawa projektu i role platformy to osobne slowniki', () => {
    const rights = read('shared/utils/project-permissions.ts')
    const roles = read('shared/utils/staff-roles.ts')

    // Neither file knows about the other; the join happens in project-rights.
    expect(rights).not.toMatch(/staff-roles|isAdmin|canModerate|StaffRole/)
    expect(roles).not.toMatch(/project-permissions|ProjectPermission|OrgPermission/)
  })
})

describe('drabina platformy sama w sobie', () => {
  it('moderator czyta, admin rzadzi, wlasciciel rozdaje', () => {
    expect(canModerate({ role: 'moderator' })).toBe(true)
    expect(isAdmin({ role: 'moderator' })).toBe(false)
    expect(isOwner({ role: 'admin' })).toBe(false)

    // and everything above inherits what is below it
    expect(canModerate({ role: 'admin' })).toBe(true)
    expect(canModerate({ role: 'owner' })).toBe(true)
    expect(isAdmin({ role: 'owner' })).toBe(true)
  })

  it('zwykle konto nie jest nikim z zespolu', () => {
    for (const role of [null, '', 'user', 'creator']) {
      expect(canModerate({ role }), String(role)).toBe(false)
    }
  })
})

// The bug this exists to stop, which shipped: five places in the browser asked
// `role === 'admin'` instead of going through the ladder. Adding `owner` above
// admin made every one of them false for the owner, so the admin link and the
// catalog half of the account menu simply vanished — the routes still worked,
// nothing linked to them, and it looked like lost access.
describe('nikt nie porownuje roli z palca', () => {
  const sources = walk('app').concat(walk('server'), walk('shared'))
    .filter(file => file.endsWith('.vue') || file.endsWith('.ts'))
    .filter(file => !slash(file).endsWith('shared/utils/staff-roles.ts'))

  it('zadna platformowa rola nie jest sprawdzana literalem', () => {
    // Only an account's own role. `member.role === 'admin'` is organisation
    // vocabulary — a different ladder with its own owner and admin — and saying
    // so by filename was too blunt: project-notify reads org members.
    const ACCOUNT = /\b(?:user|me|viewer|account|session|staff|candidate)\b[\w.?![\]'"]*\.role\s*[=!]==\s*['"](?:admin|moderator|owner)['"]/

    const offenders = sources
      .filter(file => ACCOUNT.test(read(file)))
      .map(slash)

    expect(offenders).toEqual([])
  })
})
