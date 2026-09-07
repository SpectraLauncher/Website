export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const account = await connectedAccountFor(user.id)

  // Only chased while something is still missing. Once transfers are on, the
  // account.updated webhook is what keeps this row honest, and polling Stripe on
  // every page view would buy nothing.
  const synced = account && !account.transfers_enabled
    ? await refreshAccount(account).catch(() => account)
    : account

  return {
    account: publicAccount(synced),
    countries: TRANSFER_COUNTRIES,
    // Read here rather than carried in runtimeConfig.public. That hash is
    // resolved when the bundle is built, and the image is built without any of
    // the deployment's environment, so the value would bake as empty and could
    // only be overridden by an env var named NUXT_PUBLIC_*. Reading it per
    // request keeps the name free and takes the build out of the question.
    //
    // Empty unless both halves are present: the browser needs this key to mount
    // the component, and the server needs the secret one to mint its session, so
    // one without the other is not a working setup.
    publishableKey: useStripe() ? (process.env.STRIPE_PUBLISHABLE_KEY || '') : '',
  }
})
