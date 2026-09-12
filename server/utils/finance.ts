import { q } from './db'

/**
 * The platform's side of the money.
 *
 * Read straight off the ledger and the sales rather than kept as running totals:
 * a counter that drifts from the rows it counts is worse than no counter, and
 * these are read by one person a few times a day.
 */
export interface FinanceTotals {
  /** What buyers paid, in minor units. */
  grossMinor: number
  /** The platform's cut of it. */
  feeMinor: number
  /** Sold, owed, not yet moved to anybody's Stripe account. */
  pendingMinor: number
  /** Already on creators' accounts. */
  transferredMinor: number
  sales: number
}

export async function financeTotals(): Promise<FinanceTotals> {
  const [sales] = await q<{ gross: string | null, fee: string | null, n: number }>(
    `SELECT sum(total_minor) AS gross, sum(fee_minor) AS fee, count(*)::int AS n
     FROM sale WHERE status = 'paid'`)

  const ledger = await q<{ state: string, total: string | null }>(
    `SELECT state, sum(amount_minor) AS total FROM ledger_entry GROUP BY state`)

  const byState = (state: string) =>
    Number(ledger.find(row => row.state === state)?.total ?? 0)

  return {
    grossMinor: Number(sales?.gross ?? 0),
    feeMinor: Number(sales?.fee ?? 0),
    pendingMinor: byState('pending'),
    transferredMinor: byState('transferred'),
    sales: sales?.n ?? 0,
  }
}

export interface MonthPoint {
  /** YYYY-MM, so it sorts as a string and needs no locale to compare. */
  month: string
  grossMinor: number
  feeMinor: number
}

export async function grossByMonth(months = 12): Promise<MonthPoint[]> {
  // created is epoch milliseconds, so it has to become a timestamp before
  // date_trunc can group on it.
  const rows = await q<{ month: string, gross: string | null, fee: string | null }>(
    `SELECT to_char(date_trunc('month', to_timestamp(created / 1000.0)), 'YYYY-MM') AS month,
            sum(total_minor) AS gross,
            sum(fee_minor) AS fee
     FROM sale
     WHERE status = 'paid'
       AND created >= $1
     GROUP BY 1
     ORDER BY 1`,
    [Date.now() - months * 31 * 24 * 60 * 60 * 1000],
  )

  return rows.map(row => ({
    month: row.month,
    grossMinor: Number(row.gross ?? 0),
    feeMinor: Number(row.fee ?? 0),
  }))
}

export interface PayoutQueueRow {
  id: string
  userId: string
  username: string | null
  email: string | null
  amountMinor: number
  status: string
  note: string
  requested: number
  settled: number | null
}

export async function payoutQueue(limit = 100): Promise<PayoutQueueRow[]> {
  const rows = await q<{
    id: string
    user_id: string
    username: string | null
    email: string | null
    amount_minor: string
    status: string
    note: string
    requested: string
    settled: string | null
  }>(
    `SELECT p.id, p.user_id, u.username, u.email, p.amount_minor, p.status, p.note,
            p.requested, p.settled
     FROM payout_request p
     LEFT JOIN "user" u ON u.id = p.user_id
     ORDER BY p.requested DESC
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 500)],
  )

  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    username: row.username,
    email: row.email,
    amountMinor: Number(row.amount_minor),
    status: row.status,
    note: row.note,
    requested: Number(row.requested),
    settled: row.settled === null ? null : Number(row.settled),
  }))
}

/** One row per payout, for the spreadsheet the accountant actually wants. */
export function payoutsCsv(rows: PayoutQueueRow[]): string {
  const cell = (value: unknown) => {
    const text = String(value ?? '')
    // A leading =, + or - makes a spreadsheet treat the cell as a formula.
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }

  const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : '')

  return [
    ['id', 'user', 'email', 'amount', 'status', 'requested', 'settled'].join(','),
    ...rows.map(row => [
      cell(row.id),
      cell(row.username ?? row.userId),
      cell(row.email),
      cell((row.amountMinor / 100).toFixed(2)),
      cell(row.status),
      cell(iso(row.requested)),
      cell(iso(row.settled)),
    ].join(',')),
  ].join('\n')
}
