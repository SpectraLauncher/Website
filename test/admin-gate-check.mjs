// node --experimental-strip-types test/admin-gate-check.mjs
import assert from 'node:assert/strict'
import { parseAdminEmails, isAdminEmail } from '../server/utils/admin.ts'
import { isAdmin, isOwner, isStaff, canModerate } from '../shared/utils/staff-roles.ts'

// --- the gate: a column, nothing else -------------------------------------

assert.ok(isAdmin({ role: 'admin' }), 'rola admin otwiera panel')
assert.ok(isAdmin({ role: 'owner' }), 'owner jest ponad adminem, wiec tez')
assert.ok(!isAdmin({ role: 'moderator' }), 'moderator nie siega po konta i finanse')
assert.ok(!isAdmin({ role: 'user' }), 'zwykla rola nie')

// --- drabina rol ----------------------------------------------------------

assert.ok(canModerate({ role: 'moderator' }), 'moderator moderuje')
assert.ok(canModerate({ role: 'admin' }), 'admin tez')
assert.ok(canModerate({ role: 'owner' }), 'owner tez')
assert.ok(!canModerate({ role: 'user' }), 'zwykly uzytkownik nie')

assert.ok(isOwner({ role: 'owner' }))
assert.ok(!isOwner({ role: 'admin' }), 'admin nie rozdaje rol — inaczej awansuje siebie')
assert.ok(!isOwner({ role: 'moderator' }))

for (const role of ['moderator', 'admin', 'owner']) {
  assert.ok(isStaff({ role }), `${role} nalezy do zespolu`)
}
assert.ok(!isStaff({ role: 'user' }))
assert.ok(!isStaff({}))
assert.ok(!isStaff(null))

// nieznana rola nie jest nikim wiecej niz zwykly uzytkownik
for (const role of ['staff', 'ADMIN', 'owner ', 'superadmin', '']) {
  assert.ok(!isStaff({ role }), `nieznana rola przeszla: ${JSON.stringify(role)}`)
}
assert.ok(!isAdmin({ role: null }), 'brak roli nie')
assert.ok(!isAdmin({}), 'brak pola nie')
assert.ok(!isAdmin(null))
assert.ok(!isAdmin(undefined))

// Sedno zmiany: sam adres z listy juz nic nie daje. Konto zalozone na adresie
// admina — czy to przez niezweryfikowana rejestracje, czy przez providera OAuth
// gotowego potwierdzic cudzy adres — nie jest adminem.
assert.ok(!isAdmin({ email: 'patrydab4@gmail.com' }), 'sam adres nie wystarcza')
assert.ok(!isAdmin({ email: 'patrydab4@gmail.com', role: 'user' }), 'adres nie bije roli')

// --- lista adresow: uzywana wylacznie do promocji pierwszego admina --------

const fallback = parseAdminEmails('')
assert.deepEqual(fallback, ['patrydab4@gmail.com'], 'pusta zmienna ma dac wbudowana liste')

assert.ok(isAdminEmail('patrydab4@gmail.com', fallback))
assert.ok(isAdminEmail('  PatryDab4@Gmail.com  ', fallback), 'wielkosc liter i spacje nie moga blokowac')
assert.ok(!isAdminEmail('ktos@inny.pl', fallback))
assert.ok(!isAdminEmail('', fallback))
assert.ok(!isAdminEmail(null, fallback))
assert.ok(!isAdminEmail(undefined, fallback))

// podszycie sie pod adres z listy jako poddomena/prefiks nie moze przejsc
for (const near of [
  'patrydab4@gmail.com.evil.pl',
  'x+patrydab4@gmail.com',
  'patrydab4@gmail.co',
  'patrydab4@gmailxcom'
]) {
  assert.ok(!isAdminEmail(near, fallback), `podobny adres przeszedl: ${near}`)
}

const many = parseAdminEmails(' a@x.pl , B@Y.pl ,, ')
assert.deepEqual(many, ['a@x.pl', 'b@y.pl'], 'lista ma byc przycieta i male litery')
assert.ok(!isAdminEmail('patrydab4@gmail.com', many), 'jawna lista wypiera wbudowana')

console.log('✓ admin: brama na roli w bazie, adresy tylko do pierwszej promocji')
