export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  // The role counts are what the reference's "Staff roles" panel shows. Read
  // rather than configured: a role is something an account has, not a number
  // somebody sets here.
  const staff = await q<{ role: string, n: number }>(
    `SELECT role, count(*)::int AS n FROM "user"
     WHERE role = ANY($1) GROUP BY role`,
    [[...STAFF_ROLES]],
  )

  return {
    policy: await platformPolicy(),
    staff: Object.fromEntries(staff.map(row => [row.role, row.n])),
    // Baked at build time on purpose; shown so the panel does not look like it
    // is hiding the one flag people ask about. See the note in nuxt.config.
    catalogPublic: Boolean(useRuntimeConfig().public.catalogPublic),
  }
})
