import { describe, expect, it } from 'vitest'

import { ONBOARDING_WINDOW_MS, onboardingAttempt } from '../../server/utils/seller'

// Stripe saves the response for an idempotency key for 24 hours, failures
// included. A key tied to the account alone turned one refused attempt into a
// day of replaying that refusal, however long ago the cause was fixed.
describe('klucz idempotencji przy zakladaniu konta sprzedawcy', () => {
  const base = 1_700_000_000_000

  it('dwa klikniecia obok siebie to jedna proba', () => {
    expect(onboardingAttempt('u1', base)).toBe(onboardingAttempt('u1', base + 900))
  })

  it('ponowienie po oknie to nowa proba', () => {
    expect(onboardingAttempt('u1', base))
      .not.toBe(onboardingAttempt('u1', base + ONBOARDING_WINDOW_MS))
  })

  it('rozne konta nigdy nie dziela klucza', () => {
    expect(onboardingAttempt('u1', base)).not.toBe(onboardingAttempt('u2', base))
  })
})
