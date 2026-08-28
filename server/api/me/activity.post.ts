
const MAX_SECONDS = 3600

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)

  const body = await readBody<{ launched?: boolean, seconds?: number }>(event) ?? {}

  const launches = body.launched ? 1 : 0
  const seconds = Math.min(MAX_SECONDS, Math.max(0, Math.floor(Number(body.seconds) || 0)))

  if (!launches && !seconds) return { ok: true, day: dayKey(Date.now()) }

  const day = dayKey(Date.now())

  await exec(
    `INSERT INTO user_activity (user_id, day, launches, seconds)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, day)
     DO UPDATE SET launches = user_activity.launches + EXCLUDED.launches,
                   seconds  = user_activity.seconds  + EXCLUDED.seconds`,
    [me.id, day, launches, seconds],
  )

  if (launches) await syncBadges({ userId: me.id })

  return { ok: true, day }
})
