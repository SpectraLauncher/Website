
import { projectPath } from './catalog-types'
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

// The job handler's side of a notification e-mail. It takes ids rather than
// objects because a queued job is JSON on disk, so everything it needs has to
// be looked up again when it finally runs.
export async function deliverNotificationMail(job: {
  userId: string
  kind: string
  actorId: string | null
  projectId: string | null
}) {
  if (!job.userId || !job.kind) return

  const actor = job.actorId
    ? await one<{ name: string | null, username: string | null }>(
      'SELECT name, username FROM "user" WHERE id = $1', [job.actorId])
    : null

  const project = job.projectId
    ? await one<{ title: string, slug: string, type: string }>(
      'SELECT title, slug, type FROM project WHERE id = $1', [job.projectId])
    : null

  await mailForNotification(job.userId, job.kind, {
    actorName: actor?.name || actor?.username,
    projectTitle: project?.title,
    path: project ? projectPath(project.type, project.slug) : null,
  })
}
