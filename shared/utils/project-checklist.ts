// What a project still needs before it is worth a moderator's time. This is a
// pure read over what the project already has, so the same list drives the
// interface and can be tested without a database.
//
// To add an item: one entry here, one `checklist.items.<id>` string per locale,
// and — if it should block submission — one entry in REQUIRED.
export const CHECKLIST_ITEMS = [
  'summary',
  'description',
  'icon',
  'gallery',
  'categories',
  'license',
  'version',
  'links',
  'disclosures',
] as const

export type ChecklistItem = typeof CHECKLIST_ITEMS[number]

// Everything else is advice. These are the ones without which a reader cannot
// judge the project at all, and the version is the one the server refuses a
// submission over.
export const REQUIRED: readonly ChecklistItem[] = [
  'summary',
  'description',
  'categories',
  'license',
  'version',
]

export interface ChecklistInput {
  summary?: string | null
  description?: string | null
  icon?: string | null
  license?: string | null
  categories?: readonly string[] | null
  versions?: readonly unknown[] | null
  links?: Record<string, string> | null
  disclosures?: Record<string, unknown> | null
  gallery?: readonly unknown[] | null
}

const filled = (value: string | null | undefined, min = 1) =>
  typeof value === 'string' && value.trim().length >= min

export function checklistState(input: ChecklistInput): Record<ChecklistItem, boolean> {
  return {
    // A summary that is one word is not a summary; the listing shows it alone.
    summary: filled(input.summary, 12),
    description: filled(input.description, 80),
    icon: filled(input.icon),
    gallery: (input.gallery?.length ?? 0) > 0,
    categories: (input.categories?.length ?? 0) > 0,
    license: filled(input.license),
    version: (input.versions?.length ?? 0) > 0,
    links: Object.values(input.links ?? {}).some(Boolean),
    // Ticking nothing is a valid answer, so this counts as done once the author
    // has been through the form at all — which is what the key being present
    // records.
    disclosures: input.disclosures !== null && input.disclosures !== undefined,
  }
}

export function missingRequired(state: Record<ChecklistItem, boolean>): ChecklistItem[] {
  return REQUIRED.filter(item => !state[item])
}

export function isReadyToSubmit(input: ChecklistInput): boolean {
  return missingRequired(checklistState(input)).length === 0
}
