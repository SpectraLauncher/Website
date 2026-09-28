import { beforeEach, describe, expect, it, vi } from 'vitest'
import { redeemLauncherSession } from '../server/utils/launcher-session'
import { resetRateLimits } from '../server/utils/rateLimit'

const createSession = vi.fn().mockResolvedValue({ token: 'launcher-token' })
const verifyOneTimeToken = vi.fn().mockResolvedValue({
  user: { id: 'user-1' },
  session: { token: 'browser-token' },
})

beforeEach(() => {
  resetRateLimits()
  createSession.mockClear()
  verifyOneTimeToken.mockClear()
  ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ token: 'one-time-token' })
  ;(globalThis as any).useAuth = () => ({
    api: { verifyOneTimeToken },
    $context: Promise.resolve({ internalAdapter: { createSession } }),
  })
})

describe('launcher sign-in', () => {
  it('creates a separate session with the device name and client IP', async () => {
    const event = {
      headers: { 'user-agent': 'Spectra-Launcher/0.8.2 (Windows)', 'cf-connecting-ip': '203.0.113.8' },
    } as any

    const result = await redeemLauncherSession(event)

    expect(result.session.token).toBe('launcher-token')
    expect(result.session.token).not.toBe('browser-token')
    expect(verifyOneTimeToken).toHaveBeenCalledWith({
      body: { token: 'one-time-token' },
      headers: event.headers,
    })
    expect(createSession).toHaveBeenCalledWith('user-1', false, {
      userAgent: 'Spectra-Launcher/0.8.2 (Windows)',
      ipAddress: '203.0.113.8',
    })
  })

  it('accepts old launcher agents only on the legacy sign-in route', async () => {
    const event = { headers: { 'user-agent': 'Spectra-Launcher/0.8.1' }, ip: '203.0.113.9' } as any

    await expect(redeemLauncherSession(event)).rejects.toMatchObject({ statusCode: 400 })
    expect((await redeemLauncherSession(event, true)).session.token).toBe('launcher-token')
    expect(createSession).toHaveBeenCalledWith('user-1', false, {
      userAgent: 'Spectra-Launcher/0.8.1',
      ipAddress: '203.0.113.9',
    })
  })
})
