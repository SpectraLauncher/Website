// Read-only mode. Downloads keep working, everything that writes stops.
//
// Two exemptions, and both exist so the switch can be turned back off: signing
// in, and the panel itself. Without them a maintenance mode nobody can leave is
// one bad click away.
const ALWAYS_OPEN = ['/api/auth/', '/api/admin/']

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export default defineEventHandler(async (event) => {
  if (SAFE_METHODS.has(event.method)) return

  const path = event.path.split('?')[0]!
  if (!path.startsWith('/api/')) return
  if (ALWAYS_OPEN.some(prefix => path.startsWith(prefix))) return

  // One query per write, and only while something is actually being written.
  if (!(await platformPolicy()).maintenance) return

  throw createError({
    statusCode: 503,
    statusMessage: 'Spectra is in read-only mode for a moment. Downloads work; anything that saves does not.',
  })
})
