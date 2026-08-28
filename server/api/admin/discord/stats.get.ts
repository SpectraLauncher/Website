
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const cfg = useDiscord()
  if (!cfg) return { configured: false as const }

  const [guild, channels, me, counts] = await Promise.all([
    discordRequest<{
      name: string
      icon: string | null
      approximate_member_count: number
      approximate_presence_count: number
    }>(cfg, 'GET', `/guilds/${cfg.guildId}?with_counts=true`),
    guildChannels(cfg),
    botUser(cfg),
    one<{ open: number, tickets: number, warnings: number }>(
      `SELECT
         (SELECT count(*)::int FROM discord_tickets WHERE guild_id = $1 AND status = 'open') AS open,
         (SELECT count(*)::int FROM discord_tickets WHERE guild_id = $1) AS tickets,
         (SELECT count(*)::int FROM discord_warnings WHERE guild_id = $1) AS warnings`,
      [cfg.guildId],
    ),
  ])

  return {
    configured: true as const,
    guild: {
      id: cfg.guildId,
      name: guild.name,
      icon: guild.icon,
      memberCount: guild.approximate_member_count ?? 0,
      onlineCount: guild.approximate_presence_count ?? 0,
      channels: channels.filter(c => c.type !== 4).length,
      categories: channels.filter(c => c.type === 4).length,
    },
    bot: { id: me.id, username: me.username },
    openTickets: counts?.open ?? 0,
    tickets: counts?.tickets ?? 0,
    warnings: counts?.warnings ?? 0,
  }
})
