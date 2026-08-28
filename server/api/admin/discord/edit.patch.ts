
const MAX_CONTENT = 2000

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const cfg = requireDiscord()

  const body = await readBody<{
    channelId?: string
    messageId?: string
    content?: string
    embeds?: unknown
    components?: unknown
  }>(event) ?? {}

  const channelId = requireSnowflake(body.channelId, 'channelId')
  const messageId = requireSnowflake(body.messageId, 'messageId')
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

  await discordRequest(cfg, 'PATCH', `/channels/${channelId}/messages/${messageId}`, {
    content: content || null,
    embeds,
    components,
    allowed_mentions: { parse: [] },
  })

  return { ok: true, unhandled: unhandledCustomIds(components) }
})
