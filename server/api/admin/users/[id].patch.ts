
const MIN_LENGTH = 3
const MAX_LENGTH = 30
const SHAPE = /^[a-z0-9_.]+$/

export default defineEventHandler(async (event) => {
  const staff = await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'missing id' })

  const body = await readBody<{ name?: string, username?: string, banned?: boolean }>(event) ?? {}
  const target = await one<{ id: string, username: string | null, role: string | null }>(
    'SELECT id, username, role FROM "user" WHERE id = $1', [id])
  if (!target) throw createError({ statusCode: 404, statusMessage: 'no such user' })

  // Standing at or above you on the ladder is out of reach, so two admins cannot
  // ban each other and nobody below the top can touch the owner.
  if (target.id !== staff.id && staffRank(target) >= staffRank(staff)) {
    throw createError({ statusCode: 409, statusMessage: 'that account outranks you' })
  }

  if (body.username !== undefined) {
    const username = String(body.username).trim().toLowerCase()
    if (username.length < MIN_LENGTH || username.length > MAX_LENGTH || !SHAPE.test(username)) {
      throw createError({
        statusCode: 400,
        statusMessage: `username must be ${MIN_LENGTH}–${MAX_LENGTH} characters of a–z, 0–9, _ or .`,
      })
    }
    const clash = await one<{ id: string }>(
      'SELECT id FROM "user" WHERE username = $1 AND id <> $2', [username, id])
    if (clash) throw createError({ statusCode: 409, statusMessage: 'username is taken' })

    await exec('UPDATE "user" SET username = $1, "displayUsername" = $1 WHERE id = $2', [username, id])
  }

  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 80)
    if (!name) throw createError({ statusCode: 400, statusMessage: 'name cannot be empty' })
    await exec('UPDATE "user" SET name = $1 WHERE id = $2', [name, id])
  }

  if (body.banned !== undefined) {
    const banned = !!body.banned
    await exec('UPDATE "user" SET banned = $1 WHERE id = $2', [banned, id])
    if (banned) await exec('DELETE FROM session WHERE "userId" = $1', [id])

    await recordStaffAction({
      actor: staff,
      action: banned ? 'user.ban' : 'user.unban',
      subjectKind: 'user',
      subjectId: id,
      summary: `${target.username ?? id} ${banned ? 'zablokowany' : 'odblokowany'}`,
    })
  }

  const user = await one(
    `SELECT id, name, username, email, image, "emailVerified", banned, "mcUsername"
     FROM "user" WHERE id = $1`,
    [id],
  )
  return { user }
})
