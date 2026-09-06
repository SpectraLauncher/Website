
// What a project tells people about itself before they download it. Modrinth's
// list, which covers the things this community actually argues about.
//
// To add one: an entry here, a `disclosures.<key>` string per locale, and an
// icon. A disclosure with extra choices names them in `options`.
export const DISCLOSURES = {
  ai_content: { icon: 'i-lucide-sparkles', options: ['code', 'assets', 'text', 'functionality'] },
  advertisements: { icon: 'i-lucide-megaphone', options: [] },
  epilepsy_triggers: { icon: 'i-lucide-zap', options: [] },
  system_interactions: { icon: 'i-lucide-terminal', options: [] },
  telemetry: { icon: 'i-lucide-radio', options: ['opt_in', 'opt_out'] },
  derivative_work: { icon: 'i-lucide-copy', options: [] },
  paid_features: { icon: 'i-lucide-badge-dollar-sign', options: [] },
} as const

export type DisclosureKey = keyof typeof DISCLOSURES

export const DISCLOSURE_KEYS = Object.keys(DISCLOSURES) as DisclosureKey[]

// Whether the author may still change it. A moderator who has established that
// a project does collect telemetry can pin that, so the author cannot quietly
// untick it.
export const LOCK_STATES = ['open', 'cannot_remove', 'locked'] as const
export type LockState = typeof LOCK_STATES[number]

export interface Disclosure {
  note: string
  options: string[]
  lock: LockState
}

export type DisclosureMap = Partial<Record<DisclosureKey, Disclosure>>

export const MAX_NOTE = 500

export function isDisclosureKey(value: unknown): value is DisclosureKey {
  return DISCLOSURE_KEYS.includes(value as DisclosureKey)
}

export function isLockState(value: unknown): value is LockState {
  return LOCK_STATES.includes(value as LockState)
}

export function canAuthorEdit(lock: LockState): boolean {
  return lock !== 'locked'
}

export function canAuthorRemove(lock: LockState): boolean {
  return lock === 'open'
}

function cleanOne(key: DisclosureKey, raw: unknown): Disclosure | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const body = raw as Record<string, unknown>
  const allowed = DISCLOSURES[key].options as readonly string[]

  return {
    note: String(body.note ?? '').trim().slice(0, MAX_NOTE),
    options: Array.isArray(body.options)
      ? [...new Set(body.options.filter((o): o is string =>
          typeof o === 'string' && allowed.includes(o)))]
      : [],
    lock: isLockState(body.lock) ? body.lock : 'open',
  }
}

export function cleanDisclosures(raw: unknown): DisclosureMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  const out: DisclosureMap = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isDisclosureKey(key)) continue
    const cleaned = cleanOne(key, value)
    if (cleaned) out[key] = cleaned
  }
  return out
}

// An author's edit may not touch what a moderator pinned, and may not lift a
// lock. Merging happens here rather than at the call site so no route can
// forget it.
export function mergeAuthorEdit(current: DisclosureMap, wanted: DisclosureMap): DisclosureMap {
  const out: DisclosureMap = {}

  for (const key of DISCLOSURE_KEYS) {
    const existing = current[key]
    const next = wanted[key]

    if (existing && !canAuthorEdit(existing.lock)) {
      out[key] = existing
      continue
    }

    if (!next) {
      // Removing is only allowed while nothing is pinned.
      if (existing && !canAuthorRemove(existing.lock)) out[key] = existing
      continue
    }

    out[key] = { ...next, lock: existing?.lock ?? 'open' }
  }

  return out
}

export function activeDisclosures(map: DisclosureMap): DisclosureKey[] {
  return DISCLOSURE_KEYS.filter(key => Boolean(map[key]))
}
