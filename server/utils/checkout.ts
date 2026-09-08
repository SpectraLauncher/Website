
import { exec, one, q } from './db'
import { newId } from './ids'
import { chargeItems, type ChargedItem, type CommissionSettings } from '../../shared/utils/commission'
import { CURRENCY } from '../../shared/utils/catalog-types'

// The wording a buyer agrees to before a payment starts. Stored on the sale
// rather than checked and forgotten: what matters later is which text they were
// shown, and a version that only ever existed in a template proves nothing.
export const CONSENT_TERMS = 'digital-delivery-v1'

// Ten is not a technical limit; it is the point past which a single payment
// spanning that many sellers stops being a cart and starts being a problem to
// unpick when one of them is refunded.
export const MAX_CART_ITEMS = 10

export interface CartLine extends ChargedItem {
  projectId: string
  slug: string
  title: string
  icon: string | null
  type: string
  sellerUserId: string | null
  sellerOrgId: string | null
  owned: boolean
}

interface Candidate {
  id: string
  slug: string
  title: string
  icon: string | null
  type: string
  price: number
  status: string
  owner_id: string | null
  org_id: string | null
  owned: boolean
}

// One query for the whole cart rather than one per line: a ten-item cart on a
// page that re-prices as it changes is otherwise ten round trips every time.
async function candidates(userId: string | null, keys: string[]): Promise<Candidate[]> {
  if (!keys.length) return []

  return await q<Candidate>(
    `SELECT p.id, p.slug, p.title, p.icon, p.type, p.price, p.status,
            p.owner_id, p.org_id,
            (e.user_id IS NOT NULL) AS owned
     FROM project p
     LEFT JOIN entitlement e
       ON e.project_id = p.id AND e.user_id = $1 AND e.revoked IS NULL
     WHERE p.id = ANY($2) OR p.slug = ANY($2)`,
    [userId, keys],
  )
}

export interface PricedCart {
  lines: CartLine[]
  totalMinor: number
  feeMinor: number
  problems: string[]
}

// Prices a cart without creating anything, so the page and the payment agree on
// the numbers. Every rule that could refuse a purchase is applied here, and the
// checkout runs it again rather than trusting what the browser sent back.
export async function priceCart(
  user: { id: string } | null,
  keys: unknown,
  settings: CommissionSettings,
): Promise<PricedCart> {
  const wanted = [...new Set((Array.isArray(keys) ? keys : [])
    .filter((k): k is string => typeof k === 'string' && k.length > 0)
    .map(k => k.trim()))].slice(0, MAX_CART_ITEMS)

  const found = await candidates(user?.id ?? null, wanted)
  const problems: string[] = []

  const sellable: Candidate[] = []
  for (const key of wanted) {
    const project = found.find(p => p.id === key || p.slug === key)

    if (!project || !isLinkable(project.status)) {
      problems.push('missing')
      continue
    }
    if (Number(project.price) <= 0) {
      problems.push('free')
      continue
    }
    if (project.owned) {
      problems.push('owned')
      continue
    }
    sellable.push(project)
  }

  // Every line carries the rate it was charged at, and the sale stores it, so an
  // old order never has to read today's configuration to explain itself.
  const terms = await Promise.all(sellable.map(p => sellerTermsFor(p)))
  const charged = chargeItems(
    sellable.map((p, i) => ({ priceMinor: Number(p.price), seller: terms[i]! })),
    settings,
  )

  const lines = sellable.map((project, i) => ({
    ...charged[i]!,
    projectId: project.id,
    slug: project.slug,
    title: project.title,
    icon: project.icon,
    type: project.type,
    sellerUserId: project.owner_id,
    sellerOrgId: project.org_id,
    owned: false,
  }))

  return {
    lines,
    totalMinor: lines.reduce((sum, line) => sum + line.priceMinor, 0),
    feeMinor: lines.reduce((sum, line) => sum + line.feeMinor, 0),
    problems: [...new Set(problems)],
  }
}

// An organization's projects follow the organization's standing; a personal one
// follows its owner's, including any individual arrangement.
async function sellerTermsFor(project: Candidate) {
  if (project.org_id) {
    const org = await one<{ verified: boolean }>(
      'SELECT COALESCE(verified, FALSE) AS verified FROM organization WHERE id = $1',
      [project.org_id])
    return { partner: Boolean(org?.verified), overrideBps: null }
  }

  const row = await one<{ partner: boolean, override: number | null }>(
    `SELECT COALESCE(u.partner, FALSE) AS partner, a.commission_override_bps AS override
     FROM "user" u LEFT JOIN connected_account a ON a.user_id = u.id
     WHERE u.id = $1`,
    [project.owner_id],
  )

  return { partner: Boolean(row?.partner), overrideBps: row?.override ?? null }
}

// The sale is written before the PaymentIntent exists, not after. The other way
// round has a window where Stripe holds a charge that nothing here records, and
// a buyer paying with no sale to attach it to is the one failure that costs
// somebody money. This way the worst case is an unused pending row.
//
// Nothing here grants anything: that waits for the payment to succeed.
export async function openSale(input: {
  buyerId: string | null
  buyerEmail: string
  cart: PricedCart
  consentAt: number
}): Promise<{ saleId: string, accessToken: string }> {
  const saleId = newId()

  // The only key a guest has to their files, so it is long enough that guessing
  // one is not a strategy. Signed-in buyers get it too: the receipt is the same
  // email either way, and a link that works without signing in is the point.
  const accessToken = `${newId()}${newId()}${newId()}`

  await exec(
    `INSERT INTO sale (id, buyer_id, buyer_email, access_token, status, currency,
                       total_minor, fee_minor, consent_at, consent_terms, created)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9, $10)`,
    [
      saleId, input.buyerId, input.buyerEmail.toLowerCase(), accessToken, CURRENCY,
      input.cart.totalMinor, input.cart.feeMinor, input.consentAt, CONSENT_TERMS, Date.now(),
    ],
  )

  for (const line of input.cart.lines) {
    await exec(
      `INSERT INTO sale_item (id, sale_id, project_id, title, seller_user_id, seller_org_id,
                              price_minor, fee_minor, rate_bps, min_fee_minor)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        newId(), saleId, line.projectId, line.title, line.sellerUserId, line.sellerOrgId,
        line.priceMinor, line.feeMinor, line.rateBps, line.minFeeMinor,
      ],
    )
  }

  return { saleId, accessToken }
}

// Recorded once the intent exists. The intent also carries the sale id in its
// metadata, so a webhook can still find its way home if this write is the thing
// that failed.
export async function attachIntent(saleId: string, intentId: string): Promise<void> {
  await exec('UPDATE sale SET intent_id = $2 WHERE id = $1', [saleId, intentId])
}

export interface SaleRow {
  id: string
  buyer_id: string | null
  buyer_email: string | null
  access_token: string | null
  status: string
  total_minor: number
}

const SALE_COLUMNS = 'id, buyer_id, buyer_email, access_token, status, total_minor'

export async function saleById(id: string) {
  // sql-safe: SALE_COLUMNS is a constant column list
  return await one<SaleRow>(`SELECT ${SALE_COLUMNS} FROM sale WHERE id = $1`, [id])
}

// The token is what a guest holds instead of an account. Only a paid sale opens
// anything: a pending one is somebody who reached the payment form and stopped.
export async function saleByToken(token: string) {
  // sql-safe: SALE_COLUMNS is a constant column list
  return await one<SaleRow>(
    `SELECT ${SALE_COLUMNS} FROM sale WHERE access_token = $1 AND status = 'paid'`, [token])
}

export async function saleByIntent(intentId: string) {
  // sql-safe: SALE_COLUMNS is a constant column list
  return await one<SaleRow>(
    `SELECT ${SALE_COLUMNS} FROM sale WHERE intent_id = $1`, [intentId])
}

export async function itemsOfSale(saleId: string) {
  return await q<{
    id: string
    project_id: string | null
    title: string
    seller_user_id: string | null
    seller_org_id: string | null
    price_minor: number
    fee_minor: number
  }>(
    `SELECT id, project_id, title, seller_user_id, seller_org_id, price_minor, fee_minor
     FROM sale_item WHERE sale_id = $1`,
    [saleId],
  )
}
