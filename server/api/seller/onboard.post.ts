export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  rateLimit(event, { key: `seller-onboard:${user.id}`, limit: 10, windowMs: 60_000 })

  const body = await readBody<{ orgSlug?: unknown }>(event) ?? {}
  let orgId: string | null = null

  if (body.orgSlug) {
    const org = await orgBySlug(String(body.orgSlug))
    if (!org || await isOrgMember(org.id, user.id) !== 'owner') {
      throw createError({ statusCode: 404, statusMessage: 'no such organization' })
    }
    orgId = org.id
  }

  const seller = await ensureSellerAccount({
    userId: orgId ? null : user.id,
    orgId,
    email: user.email,
  })

  const stripe = requireStripe()
  const site = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')

  // The link is single use and short lived, which is why it is minted per
  // request rather than stored.
  const link = await stripe.accountLinks.create({
    account: seller.stripe_account,
    type: 'account_onboarding',
    refresh_url: `${site}/seller`,
    return_url: `${site}/seller`,
  })

  return { url: link.url }
})
