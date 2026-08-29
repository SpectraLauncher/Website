// node --experimental-strip-types test/rate-limit-check.mjs
import assert from 'node:assert/strict'
import { take, resetRateLimits } from '../server/utils/rateLimit.ts'

resetRateLimits()

const now = 1_000_000

// Kod na odznake: jedna proba na minute.
assert.equal(take('secret:a', 1, 60_000, now).allowed, true, 'pierwsza proba przechodzi')
assert.equal(take('secret:a', 1, 60_000, now + 1).allowed, false, 'druga w tym samym oknie odpada')
assert.equal(take('secret:a', 1, 60_000, now + 59_999).allowed, false, 'tuz przed koncem okna nadal odpada')
assert.equal(take('secret:a', 1, 60_000, now + 60_001).allowed, true, 'po oknie znowu wolno')

// Konta sa liczone osobno.
assert.equal(take('secret:b', 1, 60_000, now + 1).allowed, true, 'inne konto ma wlasny licznik')

// Rendery: hojny limit, ale skonczony.
resetRateLimits()
for (let i = 1; i <= 300; i++) {
  assert.equal(take('render:1.2.3.4', 300, 60_000, now).allowed, true, `render ${i} w limicie`)
}
const over = take('render:1.2.3.4', 300, 60_000, now)
assert.equal(over.allowed, false, '301. render odrzucony')
assert.ok(over.retryAfter > 0 && over.retryAfter <= 60, `retry-after w sekundach: ${over.retryAfter}`)

// Inny adres nie dziedziczy cudzego licznika.
assert.equal(take('render:5.6.7.8', 300, 60_000, now).allowed, true, 'inny adres ma wlasny licznik')

console.log('✓ limity: 1/min na kod odznaki, 300/min na rendery, liczniki rozdzielne')
