
import type Stripe from 'stripe'

import { exec, one } from './db'
import { newId } from './ids'
import { requireStripe, stripeCall } from './stripe'

// Accounts v2 is still a preview API: it answers only when the request carries a
// dated preview version, and a preview version can change in ways a released one
// is not allowed to. Everything that touches v2 goes through this file and this
// constant, so an upgrade is one line and one place rather than a search.
export const ACCOUNTS_API_VERSION = '2026-08-26.preview'

// Transfers on the payments balance cross borders only between the US, Canada,
// the UK, the EEA and Switzerland; anywhere else the platform and the connected
// account have to share a region, and this platform is in the EEA. Onboarding
// somebody outside this list produces an account that verifies successfully and
// then cannot be paid, which is a worse outcome than refusing at the start.
//
// To add a country: put its ISO code here, once Stripe supports a transfer to it
// from an EEA platform.
export const TRANSFER_COUNTRIES: readonly string[] = [
  // EEA
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO',
  'SE', 'SI', 'SK', 'ES',
  // Outside the EEA, but reachable on the payments balance
  'CH', 'GB', 'US', 'CA',
]

export function canReceiveTransfers(country: string | null | undefined): boolean {
  return TRANSFER_COUNTRIES.includes(String(country ?? '').toUpperCase())
}

// Built as a value rather than inline at the call site so the shape can be
// asserted without a Stripe account: this object is the entire agreement about
// who verifies whom and who carries a loss.
//
// recipient, not merchant: nothing is ever charged on a connected account here.
// The buyer pays the platform and the platform transfers onwards, so the only
// capability wanted is the one that lets money arrive.
//
// dashboard has to be set when stripe_transfers is requested. 'express' rather
// than 'none' deliberately - with 'none' and losses on the application, Stripe
// hands requirement collection back to us, and collecting identity documents is
// exactly what using Connect is meant to avoid. Embedded components still work
// regardless of this setting, so onboarding stays inside our own UI.
export function recipientAccountParams(input: {
  email: string
  country: string
  displayName?: string
}): Stripe.V2.Core.AccountCreateParams {
  return {
    contact_email: input.email,
    ...(input.displayName ? { display_name: input.displayName } : {}),
    dashboard: 'express',
    identity: {
      country: input.country.toLowerCase(),
    },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            // The only capability the recipient configuration takes. Paying out
            // to a bank is not requested here - it is a balance setting, applied
            // once the account exists, in setManualPayouts below.
            stripe_transfers: { requested: true },
          },
        },
      },
    },
    defaults: {
      currency: 'eur',
      responsibilities: {
        fees_collector: 'stripe',
        losses_collector: 'stripe',
      },
    },
    include: ['configuration.recipient', 'identity', 'requirements'],
  }
}

export interface ConnectedAccountRow {
  id: string
  user_id: string
  stripe_account: string
  country: string | null
  transfers_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
  requirements: { due?: string[] }
  commission_override_bps: number | null
  created: string | number
  updated: string | number
}

const ACCOUNT_COLUMNS = `id, user_id, stripe_account, country, transfers_enabled,
  payouts_enabled, details_submitted, requirements, commission_override_bps,
  created, updated`

export async function connectedAccountFor(userId: string): Promise<ConnectedAccountRow | undefined> {
  // sql-safe: ACCOUNT_COLUMNS is a constant column list
  return await one<ConnectedAccountRow>(
    `SELECT ${ACCOUNT_COLUMNS} FROM connected_account WHERE user_id = $1`, [userId])
}

export async function connectedAccountByStripeId(
  account: string,
): Promise<ConnectedAccountRow | undefined> {
  // sql-safe: ACCOUNT_COLUMNS is a constant column list
  return await one<ConnectedAccountRow>(
    `SELECT ${ACCOUNT_COLUMNS} FROM connected_account WHERE stripe_account = $1`, [account])
}

// Whether money may actually be moved to this person yet. Everything else about
// selling works without it - that is what deferred onboarding means - so this is
// asked at transfer time, never at sale time.
export function canReceive(account: ConnectedAccountRow | undefined): boolean {
  return Boolean(account?.transfers_enabled)
}

// v2 reports capabilities and requirements in its own shape. Reading it in one
// place keeps the rest of the code from knowing which API version produced it.
export function readAccountState(account: Stripe.V2.Core.Account) {
  const balance = account.configuration?.recipient?.capabilities?.stripe_balance

  // Every requirement carries who has to act on it. Only the ones waiting on the
  // account holder belong in front of them - the rest are Stripe reviewing what
  // it already has, and showing those as a to-do list invites somebody to
  // re-upload documents that are already under review.
  const due = (account.requirements?.entries ?? [])
    .filter(entry => entry.awaiting_action_from === 'user')
    .map(entry => entry.description)
    .filter(Boolean)

  return {
    country: (account.identity?.country ?? null) as string | null,
    transfersEnabled: balance?.stripe_transfers?.status === 'active',
    payoutsEnabled: balance?.payouts?.status === 'active',
    // Nothing left for them to hand over. Not the same as being able to receive
    // money: Stripe may still be reviewing what was submitted.
    detailsSubmitted: due.length === 0,
    due,
  }
}

export async function saveAccountState(
  userId: string,
  stripeAccount: string,
  state: ReturnType<typeof readAccountState>,
): Promise<ConnectedAccountRow> {
  const now = Date.now()

  await exec(
    `INSERT INTO connected_account (id, user_id, stripe_account, country, transfers_enabled,
       payouts_enabled, details_submitted, requirements, created, updated)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
     ON CONFLICT (user_id) DO UPDATE SET
       country = EXCLUDED.country,
       transfers_enabled = EXCLUDED.transfers_enabled,
       payouts_enabled = EXCLUDED.payouts_enabled,
       details_submitted = EXCLUDED.details_submitted,
       requirements = EXCLUDED.requirements,
       updated = EXCLUDED.updated`,
    [
      newId(), userId, stripeAccount, state.country, state.transfersEnabled,
      state.payoutsEnabled, state.detailsSubmitted, JSON.stringify({ due: state.due }), now,
    ],
  )

  return (await connectedAccountFor(userId))!
}

// The preview version travels on the request rather than on the client, so the
// single Stripe instance keeps answering the released API for payments and only
// account management opts in.
function accountsOptions(): Stripe.RequestOptions {
  return { apiVersion: ACCOUNTS_API_VERSION }
}

export async function createRecipientAccount(input: {
  userId: string
  email: string
  country: string
  displayName?: string
}): Promise<ConnectedAccountRow> {
  if (!canReceiveTransfers(input.country)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'we cannot pay out to that country yet',
    })
  }

  const existing = await connectedAccountFor(input.userId)
  if (existing) return existing

  const stripe = requireStripe()
  const account = await stripeCall(() => stripe.v2.core.accounts.create(
    recipientAccountParams(input),
    accountsOptions(),
  ))

  return await saveAccountState(input.userId, account.id, readAccountState(account))
}

export async function refreshAccount(
  row: ConnectedAccountRow,
): Promise<ConnectedAccountRow> {
  const stripe = requireStripe()
  const account = await stripeCall(() => stripe.v2.core.accounts.retrieve(
    row.stripe_account,
    { include: ['configuration.recipient', 'identity', 'requirements'] },
    accountsOptions(),
  ))

  return await saveAccountState(row.user_id, row.stripe_account, readAccountState(account))
}

// Stripe would otherwise pay the account out on a daily schedule of its own.
// Manual means the money waits on their Stripe balance until they press the
// button in our UI.
//
// The clock this starts is real and is not the transfer window: once funds sit
// on a connected account under a manual schedule, Stripe requires them paid out
// within 90 days (two years in the US, ten days in Thailand). That is a limit on
// how long a seller may sit on money already transferred to them, not on how
// long we may hold it before transferring.
export async function setManualPayouts(stripeAccount: string): Promise<void> {
  const stripe = requireStripe()

  await stripeCall(() => stripe.balanceSettings.update(
    { payments: { payouts: { schedule: { interval: 'manual' } } } },
    { stripeAccount },
  ))
}

// The client secret an embedded component needs. Short lived and minted per
// request, which is why it is never stored.
export async function onboardingSessionSecret(stripeAccount: string): Promise<string> {
  const stripe = requireStripe()

  const session = await stripeCall(() => stripe.accountSessions.create({
    account: stripeAccount,
    components: {
      account_onboarding: { enabled: true },
    },
  }))

  return session.client_secret
}
