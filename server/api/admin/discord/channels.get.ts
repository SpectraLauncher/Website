
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const cfg = requireDiscord()
  return { channels: await postableChannels(cfg) }
})
