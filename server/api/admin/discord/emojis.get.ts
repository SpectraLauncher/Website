
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const cfg = requireDiscord()
  return { emojis: await guildEmojis(cfg) }
})
