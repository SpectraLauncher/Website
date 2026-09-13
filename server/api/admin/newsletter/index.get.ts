export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const rows = await subscribers()

  return {
    subscribers: rows.map(row => ({
      id: row.id,
      email: row.email,
      created: Number(row.created),
      confirmed: row.confirmed === null ? null : Number(row.confirmed),
    })),
    // What an issue would actually reach: an address that never answered the
    // confirmation is on the list and is not written to.
    confirmed: rows.filter(row => row.confirmed !== null).length,
  }
})
