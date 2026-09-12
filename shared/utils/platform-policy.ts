/**
 * Knobs that change how the platform behaves, without a deploy.
 *
 * Deliberately small: every entry here does something a test can prove. The
 * catalog's own flag is not among them — it is baked at build time on purpose,
 * so that opening the catalog to the world stays a deliberate rebuild and not a
 * checkbox somebody can tick by accident. See the note in nuxt.config.
 *
 * To add a knob: one field here, one default, one line in sanitizePolicy, and
 * the place that reads it.
 */
export interface PlatformPolicy {
  /** Read-only mode. Downloads keep working; uploads and purchases stop. */
  maintenance: boolean
  /** Whether an author may send a project to review at all. */
  submissions: boolean
  /** Whether a clean file scan is required before a project can be approved. */
  scanGate: boolean
}

export const DEFAULT_POLICY: PlatformPolicy = {
  maintenance: false,
  submissions: true,
  // On by default: approving something nobody scanned is the mistake this
  // stops, and turning it off should be a deliberate act.
  scanGate: true,
}

const bool = (value: unknown, fallback: boolean) =>
  (typeof value === 'boolean' ? value : fallback)

export function sanitizePolicy(raw: unknown): PlatformPolicy {
  const value = (raw ?? {}) as Partial<PlatformPolicy>

  return {
    maintenance: bool(value.maintenance, DEFAULT_POLICY.maintenance),
    submissions: bool(value.submissions, DEFAULT_POLICY.submissions),
    scanGate: bool(value.scanGate, DEFAULT_POLICY.scanGate),
  }
}

export const POLICY_KEYS = Object.keys(DEFAULT_POLICY) as Array<keyof PlatformPolicy>
