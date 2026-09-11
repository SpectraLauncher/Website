import { renderPostDoc } from '../../shared/utils/post-doc'
import { exec, one, q } from './db'
import { newId } from './ids'
import type { PostRow } from './posts'

export interface SubscriberRow {
  id: string
  email: string
  user_id: string | null
  token: string
  confirmed: string | number | null
  created: string | number
}

// Deliberately loose. A pattern that rejects a valid address is worse than one
// that accepts a typo, and the address proves itself by receiving mail.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isEmail(value: unknown): value is string {
  const email = String(value ?? '').trim()
  return email.length <= 320 && EMAIL.test(email)
}

/**
 * Add an address, or return the one already there.
 *
 * Never reports which of the two happened. "That address is already subscribed"
 * turns the form into a way to ask whether somebody is on the list.
 */
export async function subscribe(email: string, userId: string | null) {
  const existing = await one<SubscriberRow>(
    'SELECT id, email, user_id, token, confirmed, created FROM newsletter_subscriber WHERE lower(email) = lower($1)',
    [email],
  )
  if (existing) return existing

  return (await one<SubscriberRow>(
    `INSERT INTO newsletter_subscriber (id, email, user_id, token, confirmed, created)
     VALUES ($1, $2, $3, $4, $5, $5)
     RETURNING id, email, user_id, token, confirmed, created`,
    [newId(), email.trim(), userId, newId() + newId(), Date.now()],
  ))!
}

/** One click, no sign-in: the token in the link is the whole authorisation. */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  const row = await one<{ id: string }>(
    'DELETE FROM newsletter_subscriber WHERE token = $1 RETURNING id', [token])
  return Boolean(row)
}

export async function subscribers(): Promise<SubscriberRow[]> {
  return await q<SubscriberRow>(
    'SELECT id, email, user_id, token, confirmed, created FROM newsletter_subscriber ORDER BY created DESC')
}

export async function subscriberCount(): Promise<number> {
  const row = await one<{ n: number }>('SELECT count(*)::int AS n FROM newsletter_subscriber')
  return row?.n ?? 0
}

/**
 * The issue as an e-mail.
 *
 * Built from the same document the web page renders, so the two cannot say
 * different things, with the unsubscribe link appended per recipient — it
 * carries their token and nobody else's.
 */
export function renderIssue(post: PostRow, opts: { origin: string, token: string }) {
  const body = renderPostDoc(post.body)
  const out = `${opts.origin}/news/unsubscribe?token=${encodeURIComponent(opts.token)}`

  return {
    subject: post.title || 'Spectra',
    html: `<div style="max-width:640px;margin:0 auto;font-family:system-ui,sans-serif;color:#111;line-height:1.6">
  <h1 style="font-size:24px;margin:0 0 16px">${escapeHtml(post.title)}</h1>
  ${body}
  <hr style="margin:32px 0;border:0;border-top:1px solid #ddd">
  <p style="font-size:12px;color:#666">
    <a href="${escapeHtml(out)}" style="color:#666">Unsubscribe</a>
  </p>
</div>`,
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]!))
}

/**
 * Send an issue to everyone on the list.
 *
 * Marks the issue sent before the first message leaves, so a second click while
 * the first is still going cannot send it twice — a duplicate newsletter is not
 * something an apology fixes. One address failing does not stop the rest.
 */
export async function sendIssue(post: PostRow, origin: string): Promise<number> {
  if (post.sent) throw createError({ statusCode: 409, statusMessage: 'already sent' })

  const list = await subscribers()

  const claimed = await one<{ id: string }>(
    'UPDATE post SET sent = $2, recipients = $3 WHERE id = $1 AND sent IS NULL RETURNING id',
    [post.id, Date.now(), list.length],
  )
  if (!claimed) throw createError({ statusCode: 409, statusMessage: 'already sent' })

  let delivered = 0

  for (const row of list) {
    const mail = renderIssue(post, { origin, token: row.token })

    try {
      await sendMail(row.email, mail.subject, mail.html)
      delivered++
    }
    catch (e) {
      console.error('[newsletter] send', row.email, e)
    }
  }

  await exec('UPDATE post SET recipients = $2 WHERE id = $1', [post.id, delivered])
  return delivered
}
