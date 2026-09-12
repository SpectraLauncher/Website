
// What a report accuses something of. Modrinth's list, plus 'other' so a
// reporter is never forced into a wrong box.
//
// To add a reason: one entry here and one `reports.reasons.<key>` per locale.
export const REPORT_REASONS = [
  'spam',
  'copyright',
  'inappropriate',
  'malicious',
  'name_squatting',
  'other',
] as const

export type ReportReason = typeof REPORT_REASONS[number]

// What can be reported. Each one needs a way to reach it from the admin queue,
// so adding a type means teaching reportTarget() where it lives.
export const REPORT_ITEM_TYPES = ['project', 'version', 'user', 'comment', 'organization'] as const
export type ReportItemType = typeof REPORT_ITEM_TYPES[number]

export const REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const
export type ReportStatus = typeof REPORT_STATUSES[number]

export const MAX_REPORT_BODY = 2000

export function isReportReason(value: unknown): value is ReportReason {
  return REPORT_REASONS.includes(value as ReportReason)
}

export function isReportItemType(value: unknown): value is ReportItemType {
  return REPORT_ITEM_TYPES.includes(value as ReportItemType)
}

export function isReportStatus(value: unknown): value is ReportStatus {
  return REPORT_STATUSES.includes(value as ReportStatus)
}

export function isReportOpen(status: string): boolean {
  return status === 'open'
}

/**
 * How long a report may sit before it is late.
 *
 * A day for anything claiming the file is dangerous, three for the rest. The
 * deadline is not an alarm anybody is paged by — it is what sorts the queue and
 * turns a row red, so the oldest genuinely urgent thing is the one on top.
 */
export const SLA_MS: Record<string, number> = {
  malicious: 24 * 60 * 60 * 1000,
}

export const DEFAULT_SLA_MS = 72 * 60 * 60 * 1000

export function slaFor(reason: string): number {
  return SLA_MS[reason] ?? DEFAULT_SLA_MS
}

export interface SlaState {
  /** Milliseconds left; negative once the deadline has passed. */
  remaining: number
  late: boolean
  /** Past three quarters of the window — worth looking at before it is late. */
  soon: boolean
}

export function slaState(reason: string, created: number, now = Date.now()): SlaState {
  const budget = slaFor(reason)
  const remaining = created + budget - now

  return {
    remaining,
    late: remaining <= 0,
    soon: remaining > 0 && remaining < budget * 0.25,
  }
}
