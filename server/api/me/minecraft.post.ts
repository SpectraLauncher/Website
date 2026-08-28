
const PROFILE_URL = 'https://api.minecraftservices.com/minecraft/profile'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const { token } = await readBody<{ token?: string }>(event) ?? {}
  if (!token || typeof token !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'missing token' })
  }

  let profile: { id?: string, name?: string }
  try {
    profile = await $fetch<{ id: string, name: string }>(PROFILE_URL, {
      headers: { authorization: `Bearer ${token}` },
    })
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Minecraft did not accept that session' })
  }
  if (!profile?.id || !profile?.name) {
    throw createError({ statusCode: 502, statusMessage: 'Minecraft returned no profile' })
  }

  const taken = await one<{ id: string }>(
    'SELECT id FROM "user" WHERE "mcUuid" = $1 AND id <> $2', [profile.id, me.id])
  if (taken) {
    throw createError({ statusCode: 409, statusMessage: 'that Minecraft profile is on another account' })
  }

  await exec('UPDATE "user" SET "mcUuid" = $1, "mcUsername" = $2 WHERE id = $3',
    [profile.id, profile.name, me.id])

  await syncBadges({ userId: me.id })

  return { uuid: profile.id, username: profile.name }
})
