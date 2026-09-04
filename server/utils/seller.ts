
import { exec, one, q } from './db'
import { newId } from './ids'
import { requireStripe } from './stripe'
import { commissionMinorUnits, type SellerStanding } from './verification'

export interface SellerRow {
  id: string
  user_id: string | null
  org_id: string | null
  stripe_account: string
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
  country: string | null
  created: string | number
  updated: string | number
}

const SELLER_COLUMNS = `id, user_id, org_id, stripe_account, charges_enabled,
  payouts_enabled, details_submitted, country, created, updated`

export async function sellerFor(
  userId: string | null,
  orgId: string | null,
): Promise<SellerRow | undefined> {
  // sql-safe: SELLER_COLUMNS is a constant column list
  return await one<SellerRow>(
    `SELECT ${SELLER_COLUMNS} FROM seller
     WHERE ($1::text IS NOT NULL AND user_id = $1) OR ($2::text IS NOT NULL AND org_id = $2)`,
    [userId, orgId],
  )
}

export async function sellerByAccount(account: string): Promise<SellerRow | undefined> {
  // sql-safe: SELLER_COLUMNS is a constant column list
  return await one<SellerRow>(
    `SELECT ${SELLER_COLUMNS} FROM seller WHERE stripe_account = $1`, [account])
}

// Express accounts put identity checks, tax details and payouts on Stripe's
// side. Nothing here ever sees a bank account or a document, which is the whole
// reason for using Connect rather than collecting any of it.
export async function ensureSellerAccount(input: {
  userId: string | null
  orgId: string | null
  email: string
  country?: string
}): Promise<SellerRow> {
  const existing = await sellerFor(input.userId, input.orgId)
  if (existing) return existing

  const stripe = requireStripe()
  const account = await stripe.accounts.create({
    type: 'express',
    email: input.email,
    ...(input.country ? { country: input.country } : {}),
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
    business_profile: {
      product_description: 'Minecraft content sold on usespectra.app',
    },
  }, {
    // Two clicks race here otherwise: the second insert is refused by the unique
    // index, but Stripe already holds an account nothing points at.
    idempotencyKey: `seller:${input.orgId ?? input.userId}`,
  })

  const now = Date.now()
  // sql-safe: SELLER_COLUMNS is a constant column list
  const row = await one<SellerRow>(
    `INSERT INTO seller (id, user_id, org_id, stripe_account, country, created, updated)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     RETURNING ${SELLER_COLUMNS}`,
    [newId(), input.userId, input.orgId, account.id, account.country ?? null, now],
  )

  return row!
}

export async function refreshSellerStatus(seller: SellerRow): Promise<SellerRow> {
  const stripe = requireStripe()
  const account = await stripe.accounts.retrieve(seller.stripe_account)

  await exec(
    `UPDATE seller SET charges_enabled = $2, payouts_enabled = $3,
       details_submitted = $4, country = $5, updated = $6
     WHERE id = $1`,
    [
      seller.id,
      Boolean(account.charges_enabled),
      Boolean(account.payouts_enabled),
      Boolean(account.details_submitted),
      account.country ?? seller.country,
      Date.now(),
    ],
  )

  return (await sellerByAccount(seller.stripe_account))!
}

export function canSell(seller: SellerRow | undefined): boolean {
  return Boolean(seller?.charges_enabled)
}

export function publicSeller(seller: SellerRow | undefined) {
  if (!seller) return null
  return {
    chargesEnabled: seller.charges_enabled,
    payoutsEnabled: seller.payouts_enabled,
    detailsSubmitted: seller.details_submitted,
    country: seller.country,
  }
}

// --- purchases -----------------------------------------------------------

export interface PurchaseRow {
  id: string
  buyer_id: string
  project_id: string
  seller_id: string | null
  amount: number
  currency: string
  fee: number
  status: string
  session_id: string | null
  intent_id: string | null
  created: string | number
  completed: string | number | null
}

const PURCHASE_COLUMNS = `id, buyer_id, project_id, seller_id, amount, currency,
  fee, status, session_id, intent_id, created, completed`

export async function hasPurchased(buyerId: string, projectId: string): Promise<boolean> {
  const row = await one<{ id: string }>(
    `SELECT id FROM purchase WHERE buyer_id = $1 AND project_id = $2 AND status = 'paid'`,
    [buyerId, projectId],
  )
  return Boolean(row)
}

export async function purchasesOf(buyerId: string): Promise<PurchaseRow[]> {
  // sql-safe: PURCHASE_COLUMNS is a constant column list
  return await q<PurchaseRow>(
    `SELECT ${PURCHASE_COLUMNS} FROM purchase
     WHERE buyer_id = $1 AND status = 'paid' ORDER BY completed DESC NULLS LAST`,
    [buyerId],
  )
}

export async function pendingPurchase(
  buyerId: string,
  projectId: string,
): Promise<PurchaseRow | undefined> {
  // sql-safe: PURCHASE_COLUMNS is a constant column list
  return await one<PurchaseRow>(
    `SELECT ${PURCHASE_COLUMNS} FROM purchase
     WHERE buyer_id = $1 AND project_id = $2 AND status = 'pending'`,
    [buyerId, projectId],
  )
}

export async function openPurchase(input: {
  buyerId: string
  projectId: string
  sellerId: string
  amount: number
  currency: string
  standing: SellerStanding
  sessionId: string
}): Promise<PurchaseRow> {
  // sql-safe: PURCHASE_COLUMNS is a constant column list
  const row = await one<PurchaseRow>(
    `INSERT INTO purchase (id, buyer_id, project_id, seller_id, amount, currency,
                           fee, status, session_id, created)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)
     RETURNING ${PURCHASE_COLUMNS}`,
    [
      newId(), input.buyerId, input.projectId, input.sellerId, input.amount,
      input.currency, commissionMinorUnits(input.amount, input.standing),
      input.sessionId, Date.now(),
    ],
  )
  return row!
}

// Driven by the webhook rather than by the browser coming back from Stripe: the
// buyer closing the tab must not decide whether a payment counted.
export async function completePurchase(sessionId: string, intentId: string | null) {
  await exec(
    `UPDATE purchase SET status = 'paid', intent_id = $2, completed = $3
     WHERE session_id = $1 AND status = 'pending'`,
    [sessionId, intentId, Date.now()],
  )
}

export async function failPurchase(sessionId: string) {
  await exec(
    `UPDATE purchase SET status = 'failed' WHERE session_id = $1 AND status = 'pending'`,
    [sessionId],
  )
}

export async function refundPurchase(intentId: string) {
  await exec(
    `UPDATE purchase SET status = 'refunded' WHERE intent_id = $1 AND status = 'paid'`,
    [intentId],
  )
}
