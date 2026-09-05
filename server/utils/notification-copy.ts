
import { one } from './db'
import { localeOrDefault, translate } from './i18n-server'
import { mailNotification } from './notify-mail'

interface Context {
  actorName?: string | null
  projectTitle?: string | null
  path?: string | null
}

// Where a notification of each kind sends the reader. Anything not listed lands
// on the notification list itself.
function destination(kind: string, context: Context): string {
  if (context.path) return context.path
  if (kind.startsWith('friend')) return '/settings?tab=friends'
  return '/notifications'
}

// The subject is the same sentence the bell shows, so the two never drift.
export async function mailForNotification(userId: string, kind: string, context: Context = {}) {
  const row = await one<{ locale: string | null }>(
    'SELECT locale FROM "user" WHERE id = $1', [userId])

  const locale = localeOrDefault(row?.locale)
  const line = translate(locale, `notifications.${kind}`, {
    actor: context.actorName || translate(locale, 'notifications.someone'),
    project: context.projectTitle || '',
  })

  await mailNotification(userId, kind, {
    subject: line,
    title: line,
    body: translate(locale, 'notifications.mailBody'),
    ctaLabel: translate(locale, 'notifications.mailCta'),
    path: destination(kind, context),
  })
}
