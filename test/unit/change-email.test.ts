import { describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/db', () => ({ usePool: vi.fn(), exec: vi.fn(), one: vi.fn(), q: vi.fn() }))

const { useAuth } = await import('../../server/utils/auth')

const options = () => useAuth().options as any

function mailsTo(fn: () => Promise<unknown>) {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {})
  return fn().then(() => {
    const lines = log.mock.calls.map(c => String(c[0]))
    log.mockRestore()
    return lines
  })
}

describe('zmiana e-maila', () => {
  it('jest wlaczona', () => {
    expect(options().user.changeEmail.enabled).toBe(true)
  })

  it('nie wymaga zgody starego adresu', () => {
    expect(options().user.changeEmail.sendChangeEmailConfirmation).toBeUndefined()
  })

  it('drugi krok nie wita jak nowe konto', async () => {
    const lines = await mailsTo(() => options().emailVerification.sendVerificationEmail({
      user: { email: 'new@x.test', emailVerified: true },
      url: 'https://usespectra.app/verify',
      token: 't',
    }))
    expect(lines[0]).toMatch(/^\[mail\] new@x\.test — Confirm your new Spectra e-mail/)
  })

  it('rejestracja dalej dostaje powitanie', async () => {
    const lines = await mailsTo(() => options().emailVerification.sendVerificationEmail({
      user: { email: 'a@x.test', emailVerified: false, name: 'A' },
      url: 'https://usespectra.app/verify',
      token: 't',
    }))
    expect(lines[0]).toMatch(/Confirm your Spectra account/)
  })
})
