
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const cfg = requireDiscord()

  const channelId = String(getQuery(event).channelId ?? '')
  if (!/^\d{17,20}$/.test(channelId)) {
    throw createError({ statusCode: 400, statusMessage: 'a channel id is required' })
  }

  const [messages, me] = await Promise.all([
    discordRequest<{
      id: string
      content: string
      author: { id: string, username: string }
      embeds: unknown[]
      components?: unknown[]
      timestamp: string
      edited_timestamp: string | null
    }[]>(cfg, 'GET', `/channels/${channelId}/messages?limit=50`),
    botUser(cfg),
  ])

  return {
    messages: messages
      .filter(m => m.author.id === me.id)
      .map(m => ({
        id: m.id,
        content: m.content ?? '',
        embeds: m.embeds ?? [],
        components: m.components ?? [],
        timestamp: m.timestamp,
        editedAt: m.edited_timestamp,
      })),
  }
})
