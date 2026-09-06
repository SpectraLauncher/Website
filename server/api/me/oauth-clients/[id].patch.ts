
export default defineEventHandler(async (event) => {
  const client = await requireOwnClient(event)
  const body = await readBody<Record<string, unknown>>(event) ?? {}

  return { client: publicClient(await updateClient(client.id, body)) }
})
