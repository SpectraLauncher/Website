// Forwards the launcher's CurseForge calls with the server-side key.
// The route table and the reasoning live in server/utils/curseforge.ts.

export default defineEventHandler(async (event) => {
  rateLimit(event, { key: `curseforge:${clientIp(event)}`, limit: 120, windowMs: 60_000 })

  const key = process.env.CURSEFORGE_API_KEY
  if (!key) throw createError({ statusCode: 501, statusMessage: 'CurseForge is not configured' })

  const segments = String(getRouterParam(event, 'path') ?? '').split('/').filter(Boolean)
  const method = event.method

  if (!allowedCurseforge(method, segments)) {
    throw createError({ statusCode: 404, statusMessage: 'not found' })
  }

  const upstream = await $fetch.raw(`${CURSEFORGE_UPSTREAM}/${segments.join('/')}`, {
    method: method as 'GET' | 'POST',
    query: method === 'GET' ? getQuery(event) : undefined,
    body: method === 'POST' ? await readBody(event) : undefined,
    headers: { 'x-api-key': key, accept: 'application/json' },
    timeout: 15_000,
    retry: 0,
  }).catch((e: any) => {
    const status = e?.response?.status ?? 502
    throw createError({ statusCode: status, statusMessage: `CurseForge returned ${status}` })
  })

  // Search results and file lists change slowly; let the CDN carry the repeats.
  if (method === 'GET') setHeader(event, 'cache-control', 'public, max-age=300')

  return upstream._data
})
