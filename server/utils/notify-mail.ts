
import { sendMail, mailAssetOrigin, mailTemplate } from './auth'
import { one } from './db'
import { cleanPrefs, wantsEmail } from '../../shared/utils/notification-prefs'

interface Recipient {
  email: string
  name: string | null
  prefs: unknown
}

// The subject line and body are the only per-kind text; everything else is the
// same envelope the rest of the site already sends.
export interface MailCopy {
  subject: string
  title: string
  body: string
  ctaLabel: string
  path: string
}

export async function mailNotification(userId: string, kind: string, copy: MailCopy) {
  const user = await one<Recipient>(
    'SELECT email, name, notification_prefs AS prefs FROM "user" WHERE id = $1',
    [userId],
  )
  if (!user?.email) return

  if (!wantsEmail(cleanPrefs(user.prefs), kind)) return

  const site = mailAssetOrigin()
  await sendMail(user.email, copy.subject, mailTemplate({
    preheader: copy.body.slice(0, 140),
    eyebrow: 'Spectra',
    title: copy.title,
    body: copy.body,
    ctaUrl: `${site}${copy.path}`,
    ctaLabel: copy.ctaLabel,
    footnote: `You can change which e-mails you get at ${site}/settings?tab=notifications`,
  }))
}
