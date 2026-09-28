import type { H3Event } from 'h3'
import { clientIp, rateLimit } from './rateLimit'

// One-time-token/verify normally returns the browser's existing session. The
// launcher needs a separate session so each device can be named and revoked.
export async function redeemLauncherSession(event: H3Event, allowLegacyAgent = false) {
  rateLimit(event, { key: `launcher-session:${clientIp(event)}`, limit: 10, windowMs: 60_000 })

  const body = await readBody<{ token?: unknown }>(event) ?? {}
  const token = body.token
  const agent = getHeader(event, 'user-agent') ?? ''
  const agentMatch = /^Spectra-Launcher\/[0-9A-Za-z.+-]{1,32}(?: \((Windows|macOS|Linux)\))?$/.exec(agent)
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(token)
    || !agentMatch || (!allowLegacyAgent && !agentMatch[1])) {
    throw createError({ statusCode: 400, statusMessage: 'invalid launcher sign-in' })
  }

  const auth = useAuth()
  const redeemed = await auth.api.verifyOneTimeToken({ body: { token }, headers: event.headers }).catch(() => null)
  if (!redeemed?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'launcher sign-in expired' })
  }

  const ip = clientIp(event)
  const context = await auth.$context
  const session = await context.internalAdapter.createSession(redeemed.user.id, false, {
    userAgent: agent,
    ipAddress: ip === 'unknown' ? '' : ip,
  })
  if (!session) throw createError({ statusCode: 503, statusMessage: 'could not create launcher session' })

  return { session: { token: session.token } }
}
