export default defineEventHandler(async (event) => {
  const user = await requireStaff(event)

  // The role travels to the browser so the navigation can leave out what this
  // account would only get a 404 from. It is not the gate — every route checks
  // again — it is what stops the panel offering a dead end.
  return { ok: true, username: user.username ?? null, role: user.role ?? null }
})
