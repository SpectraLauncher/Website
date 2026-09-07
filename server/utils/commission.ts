
// Where the numbers come from. The arithmetic they feed is in
// shared/utils/commission.ts, so the author's pricing form works a fee out
// exactly the way the checkout will.
import { one } from './db'
import {
  type CommissionSettings,
  rateBpsFor,
  sanitizeSettings,
} from '../../shared/utils/commission'

export const SETTING_KEY = 'commission'

// Every setting is one row of JSON rather than a column per knob, because the
// alternative is a migration every time a number needs to move and the whole
// point is changing these without a deploy.
export async function commissionSettings(): Promise<CommissionSettings> {
  const row = await one<{ value: Partial<CommissionSettings> }>(
    'SELECT value FROM platform_setting WHERE key = $1', [SETTING_KEY])

  return sanitizeSettings(row?.value)
}

// The rate a given project's sale would be charged at, resolved from whoever
// gets paid for it. An organization's projects follow the organization's own
// standing rather than any one member's: the fee comes off the sale before the
// split, so there is no single member it could belong to.
export async function termsForProject(project: {
  owner_id: string | null
  org_id: string | null
}): Promise<{ rateBps: number, minFeeMinor: number, minPriceMinor: number }> {
  const settings = await commissionSettings()

  const rateBps = project.org_id
    ? await orgRateBps(project.org_id, settings)
    : await userRateBps(project.owner_id, settings)

  return { rateBps, minFeeMinor: settings.minFeeMinor, minPriceMinor: settings.minPriceMinor }
}

async function orgRateBps(orgId: string, settings: CommissionSettings): Promise<number> {
  const org = await one<{ verified: boolean }>(
    'SELECT COALESCE(verified, FALSE) AS verified FROM organization WHERE id = $1', [orgId])

  return org?.verified ? settings.partnerRateBps : settings.rateBps
}

async function userRateBps(
  userId: string | null,
  settings: CommissionSettings,
): Promise<number> {
  if (!userId) return settings.rateBps

  const row = await one<{ partner: boolean, override: number | null }>(
    `SELECT COALESCE(u.partner, FALSE) AS partner, a.commission_override_bps AS override
     FROM "user" u LEFT JOIN connected_account a ON a.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  )

  return rateBpsFor(settings, {
    partner: Boolean(row?.partner),
    overrideBps: row?.override ?? null,
  })
}


export const TRANSFER_KEY = 'transfers'

export interface TransferSettings {
  graceDays: number
  minPayoutMinor: number
}

// The wait between a sale and moving the money on. It is not a Stripe deadline -
// the API documents none for a transfer against a charge - it is our own window
// for a dispute or a licence complaint to surface while the funds are still
// somewhere we control.
export const TRANSFER_DEFAULTS: TransferSettings = {
  graceDays: 7,
  minPayoutMinor: 1000,
}

export async function transferSettings(): Promise<TransferSettings> {
  const row = await one<{ value: Partial<TransferSettings> }>(
    'SELECT value FROM platform_setting WHERE key = $1', [TRANSFER_KEY])

  const raw = (row?.value ?? {}) as Record<string, unknown>
  const whole = (value: unknown, fallback: number, min: number) => {
    if (typeof value !== 'number' && typeof value !== 'string') return fallback
    const n = Math.floor(Number(value))
    return Number.isFinite(n) && n >= min ? n : fallback
  }

  return {
    graceDays: whole(raw.graceDays, TRANSFER_DEFAULTS.graceDays, 0),
    minPayoutMinor: whole(raw.minPayoutMinor, TRANSFER_DEFAULTS.minPayoutMinor, 1),
  }
}
