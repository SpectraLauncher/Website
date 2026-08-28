
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const cfg = requireDiscord()

  const query = String(getQuery(event).q ?? '').trim()
  if (query.length < 2) return { members: [] }

  const members = await discordRequest<{
    user: { id: string, username: string, global_name: string | null, avatar: string | null, bot?: boolean }
    nick: string | null
    roles: string[]
    joined_at: string
    communication_disabled_until: string | null
  }[]>(cfg, 'GET', `/guilds/${cfg.guildId}/members/search?query=${encodeURIComponent(query)}&limit=10`)

  const linked = await spectraAccountsFor(members.map(m => m.user.id))

  return {
    members: members.map((m) => {
      const spectra = linked.get(m.user.id) ?? null
      return {
        id: m.user.id,
        username: m.user.username,
        displayName: m.nick || m.user.global_name || m.user.username,
        avatar: m.user.avatar,
        bot: !!m.user.bot,
        joinedAt: m.joined_at,
        mutedUntil: m.communication_disabled_until
          && new Date(m.communication_disabled_until) > new Date()
          ? m.communication_disabled_until
          : null,
        spectra: spectra && {
          id: spectra.id,
          username: spectra.username,
          mcUsername: spectra.mcUsername,
          banned: !!spectra.banned,
        },
      }
    }),
  }
})
