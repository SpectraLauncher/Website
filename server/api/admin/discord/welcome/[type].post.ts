
const TYPES = new Set(['welcome', 'farewell'])
const MESSAGE_TYPES = new Set(['text', 'embed'])

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const cfg = requireDiscord()

  const type = String(getRouterParam(event, 'type') ?? '')
  if (!TYPES.has(type)) throw createError({ statusCode: 400, statusMessage: 'welcome or farewell' })

  const body = await readBody<{
    enabled?: boolean
    channelId?: string | null
    messageType?: string
    content?: string
    embed?: Record<string, unknown>
  }>(event) ?? {}

  const enabled = !!body.enabled
  const channelId = body.channelId ? requireSnowflake(body.channelId, 'channelId') : null
  const messageType = MESSAGE_TYPES.has(String(body.messageType)) ? String(body.messageType) : 'text'
  const content = String(body.content ?? '').slice(0, 2000)

  const [embed = {}] = cleanEmbeds([body.embed])

  if (enabled && messageType === 'embed' && !Object.keys(embed).length) {
    throw createError({ statusCode: 400, statusMessage: 'the embed is empty' })
  }
  if (enabled && messageType === 'text' && !content.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'the message is empty' })
  }

  if (enabled && !channelId) {
    throw createError({ statusCode: 400, statusMessage: 'pick a channel before enabling it' })
  }

  await exec(
    `INSERT INTO discord_welcome
       (guild_id, event_type, enabled, channel_id, message_type, content, embed_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (guild_id, event_type) DO UPDATE SET
       enabled      = EXCLUDED.enabled,
       channel_id   = EXCLUDED.channel_id,
       message_type = EXCLUDED.message_type,
       content      = EXCLUDED.content,
       embed_json   = EXCLUDED.embed_json`,
    [cfg.guildId, type, enabled, channelId, messageType, content, JSON.stringify(embed)],
  )

  return { ok: true }
})
