
// Which notifications exist, and which channels each may travel on.
//
// To add a kind: one entry here, the matching `notifications.<kind>` string per
// locale, an icon in NOTIFICATION_ICONS, and the kind in NotificationKind on the
// server. Anything not listed here is delivered in-app only.
export const NOTIFICATION_CHANNELS = ['site', 'email'] as const
export type NotificationChannel = typeof NOTIFICATION_CHANNELS[number]

export const NOTIFICATION_GROUPS = {
  social: ['friend_request', 'friend_accepted'],
  packs: ['instance_invite', 'instance_update'],
  projects: ['project_approved', 'project_rejected', 'project_removed', 'project_message'],
  comments: ['project_comment', 'comment_reply'],
  moderation: ['report_received', 'report_closed'],
} as const

export type NotificationGroup = keyof typeof NOTIFICATION_GROUPS

export const NOTIFICATION_GROUP_KEYS = Object.keys(NOTIFICATION_GROUPS) as NotificationGroup[]

export function groupOf(kind: string): NotificationGroup | null {
  for (const group of NOTIFICATION_GROUP_KEYS) {
    if ((NOTIFICATION_GROUPS[group] as readonly string[]).includes(kind)) return group
  }
  return null
}

// A decision the user did not make yet. In-app is always on — it costs nothing
// and the bell is the record of what happened. Mail is off except where it
// carries something the user cannot discover by looking: a moderation verdict
// on their own project.
export const DEFAULT_PREFS: Record<NotificationGroup, NotificationChannel[]> = {
  social: ['site'],
  packs: ['site'],
  projects: ['site', 'email'],
  comments: ['site'],
  moderation: ['site', 'email'],
}

export type NotificationPrefs = Record<string, NotificationChannel[]>

export function isChannel(value: unknown): value is NotificationChannel {
  return NOTIFICATION_CHANNELS.includes(value as NotificationChannel)
}

export function cleanPrefs(raw: unknown): NotificationPrefs {
  const out: NotificationPrefs = {}
  const body = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>

  for (const group of NOTIFICATION_GROUP_KEYS) {
    const wanted = body[group]
    out[group] = Array.isArray(wanted)
      // The bell is not negotiable, so 'site' survives whatever was sent.
      ? [...new Set(['site' as NotificationChannel, ...wanted.filter(isChannel)])]
      : DEFAULT_PREFS[group]
  }

  return out
}

export function wantsEmail(prefs: NotificationPrefs, kind: string): boolean {
  const group = groupOf(kind)
  if (!group) return false
  return (prefs[group] ?? DEFAULT_PREFS[group]).includes('email')
}
