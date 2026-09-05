
export interface NotificationActor {
  id: string
  name: string | null
  username: string | null
  image: string | null
}

export interface NotificationProject {
  id: string
  title: string | null
  icon: string | null
  path: string
}

export interface NotificationItem {
  id: number
  kind: string
  shareCode: string | null
  data: Record<string, unknown> | null
  read: boolean
  created: number
  actor: NotificationActor | null
  project: NotificationProject | null
}

// Adding a kind: an entry here, the matching `notifications.<kind>` string in
// every locale, and the kind itself in NotificationKind on the server.
export const NOTIFICATION_ICONS: Record<string, string> = {
  friend_request: 'i-lucide-user-plus',
  friend_accepted: 'i-lucide-user-check',
  instance_invite: 'i-lucide-package',
  instance_update: 'i-lucide-refresh-cw',
  project_approved: 'i-lucide-badge-check',
  project_rejected: 'i-lucide-circle-x',
  project_removed: 'i-lucide-trash-2',
  project_message: 'i-lucide-gavel',
  project_comment: 'i-lucide-message-square',
  comment_reply: 'i-lucide-reply',
}

export function notificationIcon(kind: string): string {
  return NOTIFICATION_ICONS[kind] ?? 'i-lucide-bell'
}

// One poll shared by every component that shows notifications, so the bell and
// the page do not each hit the endpoint on their own schedule.
export function useNotifications() {
  const items = useState<NotificationItem[]>('notifications', () => [])
  const unread = useState('notifications:unread', () => 0)
  const loaded = useState('notifications:loaded', () => false)

  async function refresh() {
    try {
      const res = await $fetch<{ unread: number, notifications: NotificationItem[] }>('/api/notifications')
      items.value = res.notifications
      unread.value = res.unread
      loaded.value = true
    }
    catch {
      // Signed out or offline — the bell simply stays where it was.
    }
  }

  async function markRead(ids?: number[]) {
    const target = ids ?? items.value.filter(n => !n.read).map(n => n.id)
    if (!target.length) return

    await $fetch('/api/notifications/read', { method: 'POST', body: { ids } })
    for (const item of items.value) {
      if (!ids || ids.includes(item.id)) item.read = true
    }
    unread.value = Math.max(0, unread.value - target.length)
  }

  async function dismiss(id: number) {
    await $fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    const item = items.value.find(n => n.id === id)
    if (item && !item.read) unread.value = Math.max(0, unread.value - 1)
    items.value = items.value.filter(n => n.id !== id)
  }

  return { items, unread, loaded, refresh, markRead, dismiss }
}
