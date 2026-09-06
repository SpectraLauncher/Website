
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)

  return {
    authorizations: (await grantedClients(me.id)).map(row => ({
      id: row.id,
      name: row.name,
      icon: row.icon,
      scopes: maskToScopes(Number(row.scopes)),
      created: Number(row.created),
    })),
  }
})
