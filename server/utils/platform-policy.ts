import { exec, one } from './db'
import { type PlatformPolicy, sanitizePolicy } from '../../shared/utils/platform-policy'

export const POLICY_KEY = 'policy'

export async function platformPolicy(): Promise<PlatformPolicy> {
  const row = await one<{ value: Partial<PlatformPolicy> }>(
    'SELECT value FROM platform_setting WHERE key = $1', [POLICY_KEY])

  return sanitizePolicy(row?.value)
}

/**
 * Write the whole policy back.
 *
 * Merged on top of what is stored and sanitised on the way in, so a field the
 * caller left out keeps its value and a field it invented never lands.
 */
export async function savePolicy(patch: Partial<PlatformPolicy>): Promise<PlatformPolicy> {
  const next = sanitizePolicy({ ...await platformPolicy(), ...patch })

  await exec(
    `INSERT INTO platform_setting (key, value, updated) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated = $3`,
    [POLICY_KEY, JSON.stringify(next), Date.now()],
  )

  return next
}
