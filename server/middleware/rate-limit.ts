// Applies the per-IP rules from server/utils/rateLimit.ts to the public API.
export default defineEventHandler((event) => {
  const path = event.path.split('?')[0]!
  if (!path.startsWith('/api/')) return

  const rule = limitFor(path, event.method)
  if (!rule) return

  rateLimit(event, { key: `${rule.name}:${clientIp(event)}`, limit: rule.limit, windowMs: 60_000 })
})
