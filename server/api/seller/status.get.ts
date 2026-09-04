export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const own = await sellerFor(user.id, null)
  const refreshed = own && !own.charges_enabled ? await refreshSellerStatus(own) : own

  const organizations = await organizationsOf(user.id)
  const owned = organizations.filter(org => org.role === 'owner')

  const orgSellers = await Promise.all(owned.map(async (org) => {
    const seller = await sellerFor(null, org.id)
    const synced = seller && !seller.charges_enabled ? await refreshSellerStatus(seller) : seller
    return { slug: org.slug, name: org.name, seller: publicSeller(synced) }
  }))

  return {
    account: publicSeller(refreshed),
    organizations: orgSellers,
    partner: Boolean((user as { partner?: boolean }).partner),
    currencies: CURRENCIES,
  }
})
