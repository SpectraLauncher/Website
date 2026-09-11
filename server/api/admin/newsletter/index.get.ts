export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  return {
    subscribers: (await subscribers()).map(row => ({
      id: row.id,
      email: row.email,
      created: Number(row.created),
    })),
  }
})
