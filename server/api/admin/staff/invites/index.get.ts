export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const rows = await listInvites()

  return {
    invites: rows.map(row => ({
      ...publicInvite(row),
      status: row.status,
      answered: row.answered === null ? null : Number(row.answered),
      user: {
        id: row.user_id,
        username: row.username,
        email: row.email,
        image: row.image,
        role: row.current_role,
      },
    })),
  }
})
