
const MAX_CONTENT = 2000

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const cfg = requireDiscord()

  const body = await readBody<{
    channelId?: string
    content?: string
    embeds?: unknown
    components?: unknown
    allowMentions?: boolean
  }>(event) ?? {}

  const channelId = requireSnowflake(body.channelId, 'channelId')
  const content = String(body.content ?? '').trim()

  if (content.length > MAX_CONTENT) {
    throw createError({
      statusCode: 400,
      statusMessage: `message is ${content.length} characters, Discord allows ${MAX_CONTENT}`,
    })
  }

  const embeds = cleanEmbeds(body.embeds)
  const components = cleanComponents(body.components)

  if (!content && !embeds.length) {
    throw createError({ statusCode: 400, statusMessage: 'add some text or an embed' })
  }

  const sent = await discordRequest<{ id: string }>(
    cfg, 'POST', `/channels/${channelId}/messages`, {
      ...(content ? { content } : {}),
      ...(embeds.length ? { embeds } : {}),
      ...(components.length ? { components } : {}),
      allowed_mentions: body.allowMentions
        ? { parse: ['users', 'roles', 'everyone'] }
        : { parse: [] },
    })

  return { id: sent.id, unhandled: unhandledCustomIds(components) }
})
