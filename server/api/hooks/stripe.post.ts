export default defineEventHandler(async (event) => {
  const stripe = useStripe()
  const secret = stripeWebhookSecret()

  // No signature check possible means no webhook. Accepting unverified calls
  // here would let anyone mark any purchase as paid.
  if (!stripe || !secret) {
    throw createError({ statusCode: 404, statusMessage: 'not found' })
  }

  const signature = getHeader(event, 'stripe-signature')
  const raw = await readRawBody(event, false)
  if (!signature || !raw?.length) {
    throw createError({ statusCode: 400, statusMessage: 'missing signature' })
  }

  let parsed
  try {
    parsed = stripe.webhooks.constructEvent(raw, signature, secret)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'bad signature' })
  }

  switch (parsed.type) {
    case 'checkout.session.completed': {
      const session = parsed.data.object
      if (session.payment_status === 'paid') {
        await completePurchase(session.id, String(session.payment_intent ?? '') || null)
      }
      break
    }
    case 'checkout.session.expired': {
      await failPurchase(parsed.data.object.id)
      break
    }
    case 'charge.refunded': {
      const intent = String(parsed.data.object.payment_intent ?? '')
      if (intent) await refundPurchase(intent)
      break
    }
    case 'account.updated': {
      const account = parsed.data.object
      const seller = await sellerByAccount(account.id)
      if (seller) await refreshSellerStatus(seller)
      break
    }
  }

  return { received: true }
})
