
// How much one account may own. A rate limit caps how fast something is
// created; this caps how much exists, which is the different question.
//
// To add a limit: one entry here, one counting query in accountUsage(), and the
// check at the place that creates the thing.
export const ACCOUNT_LIMITS = {
  projects: 50,
  organizations: 10,
  collections: 100,
  versionsPerProject: 500,
} as const

export type AccountLimit = keyof typeof ACCOUNT_LIMITS

export const ACCOUNT_LIMIT_KEYS = Object.keys(ACCOUNT_LIMITS) as AccountLimit[]

export interface LimitState {
  current: number
  max: number
}

export function isAccountLimit(value: unknown): value is AccountLimit {
  return ACCOUNT_LIMIT_KEYS.includes(value as AccountLimit)
}

export function atLimit(state: LimitState | undefined): boolean {
  return Boolean(state) && state!.current >= state!.max
}
