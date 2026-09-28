import { redeemLauncherSession } from '../../utils/launcher-session'

export default defineEventHandler((event) => {
  // Older launchers still call this address. Keep them working while issuing
  // a separate session instead of returning the browser's session token.
  if (event.path.split('?')[0] === '/api/auth/one-time-token/verify') {
    const agent = getHeader(event, 'user-agent') ?? ''
    if (!agent.startsWith('Spectra-Launcher/')) {
      throw createError({ statusCode: 404, statusMessage: 'not found' })
    }
    return redeemLauncherSession(event, true)
  }
  return useAuth().handler(toWebRequest(event))
})
