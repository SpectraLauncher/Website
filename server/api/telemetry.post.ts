
interface IncomingEvent {
  event?: unknown
  props?: unknown
}
interface IncomingBatch {
  install_id?: unknown
  version?: unknown
  os?: unknown
  arch?: unknown
  locale?: unknown
  events?: unknown
}

const MAX_EVENTS = 50
const MAX_PROPS_BYTES = 2000

export default defineEventHandler(async (event) => {
  setHeader(event, 'access-control-allow-origin', '*')

  const key = ingestKey()
  if (key) {
    if (getHeader(event, 'x-spectra-key') !== key) {
      throw createError({ statusCode: 401, statusMessage: 'invalid key' })
    }
  }

  const body = await readBody<IncomingBatch>(event)
  const installId = clampStr(body?.install_id, 64)
  if (!installId) {
    throw createError({ statusCode: 400, statusMessage: 'install_id required' })
  }

  const list = Array.isArray(body?.events) ? (body!.events as IncomingEvent[]) : []
  if (!list.length) return { ok: true, accepted: 0 }

  const version = clampStr(body?.version, 32) ?? null
  const os = clampStr(body?.os, 16) ?? null
  const arch = clampStr(body?.arch, 16) ?? null
  const locale = clampStr(body?.locale, 16) ?? null

  const now = Date.now()
  const day = dayKey(now)

  const values: unknown[] = []
  const tuples: string[] = []
  for (const e of list.slice(0, MAX_EVENTS)) {
    const name = clampStr(e?.event, 32)
    if (!name || !ALLOWED_EVENTS.has(name)) continue

    let props: string | null = null
    if (e?.props && typeof e.props === 'object') {
      const json = JSON.stringify(e.props)
      if (json.length <= MAX_PROPS_BYTES) props = json
    }

    const base = values.length
    values.push(now, day, installId, name, version, os, arch, locale, props)
    tuples.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, `
      + `$${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`)
  }

  if (tuples.length) {
    // sql-safe: tuples are generated `($1, $2, …)` placeholders; the data is in `values`
    await exec(
      `INSERT INTO events (ts, day, install_id, event, version, os, arch, locale, props)
       VALUES ${tuples.join(', ')}`,
      values,
    )
  }

  if (Math.random() < 0.02) await pruneOld()

  return { ok: true, accepted: tuples.length }
})
