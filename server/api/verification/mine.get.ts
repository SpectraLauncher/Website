export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const requests = await requestsForUser(user.id)
  const organizations = await organizationsOf(user.id)

  return {
    requests: requests.map(publicRequest),
    // Everything the form needs to know what may still be applied for.
    standing: {
      partner: Boolean((user as { partner?: boolean }).partner),
      organizations: organizations.filter(org => org.role === 'owner'),
    },
  }
})
