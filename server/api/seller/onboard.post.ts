export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  rateLimit(event, { key: `seller-onboard:${user.id}`, limit: 10, windowMs: 60_000 })

  const existing = await connectedAccountFor(user.id)

  // The country is fixed at creation and Stripe will not let it move afterwards,
  // so it is only read when there is no account yet - a later request cannot
  // quietly relocate somebody.
  const account = existing ?? await (async () => {
    const body = await readBody<{ country?: unknown }>(event) ?? {}
    const country = String(body.country ?? '').toUpperCase()

    if (!canReceiveTransfers(country)) {
      throw createError({ statusCode: 400, statusMessage: 'pick a country we can pay out to' })
    }

    const created = await createRecipientAccount({
      userId: user.id,
      email: user.email,
      country,
      displayName: user.name || undefined,
    })

    await setManualPayouts(created.stripe_account).catch(e =>
      console.error('[connect] could not set manual payouts', created.stripe_account, e))

    return created
  })()

  // Minted per request and short lived, which is why it is never stored. Connect
  // .js asks for a fresh one whenever the session it holds expires.
  return { clientSecret: await onboardingSessionSecret(account.stripe_account) }
})
