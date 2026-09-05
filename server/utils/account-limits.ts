
import { one } from './db'
import {
  ACCOUNT_LIMITS,
  type AccountLimit,
  type LimitState,
} from '../../shared/utils/account-limits'

// A per-account override, so a partner or a big team can be raised without
// moving the number for everyone. NULL means the shared default.
async function ceiling(userId: string, limit: AccountLimit): Promise<number> {
  const row = await one<{ limits: Record<string, number> | null }>(
    'SELECT limits FROM "user" WHERE id = $1', [userId])

  const override = row?.limits?.[limit]
  return typeof override === 'number' && override >= 0 ? override : ACCOUNT_LIMITS[limit]
}

const COUNTS: Record<AccountLimit, (userId: string) => Promise<number>> = {
  // A project owned through an organization counts against the organization,
  // not against every member of it.
  projects: async (userId) => {
    const row = await one<{ n: number }>(
      'SELECT count(*)::int AS n FROM project WHERE owner_id = $1', [userId])
    return row?.n ?? 0
  },

  organizations: async (userId) => {
    const row = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM member WHERE "userId" = $1 AND role = 'owner'`, [userId])
    return row?.n ?? 0
  },

  collections: async (userId) => {
    const row = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM collection WHERE user_id = $1 AND kind <> 'favourites'`,
      [userId])
    return row?.n ?? 0
  },

  // Counted per project rather than per account, so this one is asked about a
  // project id instead of a user id.
  versionsPerProject: async (projectId) => {
    const row = await one<{ n: number }>(
      'SELECT count(*)::int AS n FROM version WHERE project_id = $1', [projectId])
    return row?.n ?? 0
  },
}

export async function limitState(
  subjectId: string,
  limit: AccountLimit,
  ownerId = subjectId,
): Promise<LimitState> {
  return {
    current: await COUNTS[limit](subjectId),
    max: await ceiling(ownerId, limit),
  }
}

// Throws rather than returning a flag: every caller would otherwise have to
// remember to check, and forgetting is silent.
export async function requireHeadroom(
  subjectId: string,
  limit: AccountLimit,
  ownerId = subjectId,
): Promise<void> {
  const state = await limitState(subjectId, limit, ownerId)
  if (state.current >= state.max) {
    throw createError({
      statusCode: 409,
      statusMessage: `you have reached the limit of ${state.max}`,
    })
  }
}

export async function accountUsage(userId: string): Promise<Record<string, LimitState>> {
  const out: Record<string, LimitState> = {}
  for (const limit of ['projects', 'organizations', 'collections'] as const) {
    out[limit] = await limitState(userId, limit)
  }
  return out
}
