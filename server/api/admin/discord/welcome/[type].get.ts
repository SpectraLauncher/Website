
const TYPES = new Set(['welcome', 'farewell'])

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const cfg = requireDiscord()

  const type = String(getRouterParam(event, 'type') ?? '')
  if (!TYPES.has(type)) throw createError({ statusCode: 400, statusMessage: 'welcome or farewell' })

  const row = await one<{
    enabled: boolean
    channel_id: string | null
    message_type: string
    content: string
    embed_json: Record<string, unknown>
  }>(
    `SELECT enabled, channel_id, message_type, content, embed_json
     FROM discord_welcome WHERE guild_id = $1 AND event_type = $2`,
    [cfg.guildId, type],
  )

  return {
    config: {
      enabled: row?.enabled ?? false,
      channelId: row?.channel_id ?? null,
      messageType: row?.message_type ?? 'text',
      content: row?.content ?? '',
      embed: row?.embed_json ?? {},
    },
    variables: ['{username}', '{displayname}', '{mention}', '{servername}', '{membercount}', '{id}'],
  }
})
