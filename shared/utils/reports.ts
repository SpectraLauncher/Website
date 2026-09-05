
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
