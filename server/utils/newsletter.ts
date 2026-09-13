import { renderPostDoc } from '../../shared/utils/post-doc'
import { one, q } from './db'
import { newId } from './ids'
import { enqueue } from './queue'
import { postById } from './posts'
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
 *
 * The address arrives unconfirmed: anybody can type somebody else's into a form,
 * so it is the click in the mailbox that decides, not the submit. Nothing is
 * ever sent to an address that has not answered.
 */
export async function subscribe(email: string, userId: string | null) {
  const existing = await one<SubscriberRow>(
    'SELECT id, email, user_id, token, confirmed, created FROM newsletter_subscriber WHERE lower(email) = lower($1)',
    [email],
  )
  if (existing) return existing

  return (await one<SubscriberRow>(
    `INSERT INTO newsletter_subscriber (id, email, user_id, token, confirmed, created)
     VALUES ($1, $2, $3, $4, NULL, $5)
     RETURNING id, email, user_id, token, confirmed, created`,
    [newId(), email.trim(), userId, newId() + newId(), Date.now()],
  ))!
}

/** One click in the mailbox. The token is the whole authorisation. */
export async function confirmByToken(token: string): Promise<boolean> {
  const row = await one<{ id: string }>(
    `UPDATE newsletter_subscriber SET confirmed = $2
     WHERE token = $1 AND confirmed IS NULL RETURNING id`,
    [token, Date.now()],
  )
  return Boolean(row)
}

/**
 * The "please confirm" mail.
 *
 * Carries the unsubscribe link too: somebody whose address was typed in by a
 * stranger should be able to end it from the same message, without confirming
 * anything first.
 */
export async function sendConfirmation(row: SubscriberRow, origin: string) {
  const confirm = `${origin}/news/confirm?token=${encodeURIComponent(row.token)}`
  const out = `${origin}/news/unsubscribe?token=${encodeURIComponent(row.token)}`

  await sendMail(row.email, 'Potwierdź zapis do newslettera Spectra', mailTemplate({
    preheader: 'Jeden klik i będziesz dostawać newsletter Spectry.',
    eyebrow: 'Spectra',
    title: 'Potwierdź zapis',
    body: 'Ktoś podał ten adres przy zapisie do newslettera Spectry. '
      + 'Jeśli to ty — potwierdź poniżej. Jeśli nie, po prostu zignoruj tę wiadomość; '
      + 'bez potwierdzenia nic nie wyślemy.',
    ctaUrl: confirm,
    ctaLabel: 'Potwierdzam zapis',
    footnote: `Nie chcesz tego? ${out}`,
  }))
}

/** One click, no sign-in: the token in the link is the whole authorisation. */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  const row = await one<{ id: string }>(
    'DELETE FROM newsletter_subscriber WHERE token = $1 RETURNING id', [token])
  return Boolean(row)
}

/** Everyone on the list, confirmed or not — the admin sees both. */
export async function subscribers(): Promise<SubscriberRow[]> {
  return await q<SubscriberRow>(
    'SELECT id, email, user_id, token, confirmed, created FROM newsletter_subscriber ORDER BY created DESC')
}

/** Who an issue actually goes to. Never an address that has not answered. */
export async function confirmedSubscribers(): Promise<SubscriberRow[]> {
  return await q<SubscriberRow>(
    `SELECT id, email, user_id, token, confirmed, created FROM newsletter_subscriber
     WHERE confirmed IS NOT NULL ORDER BY created DESC`)
}

export async function subscriberCount(): Promise<number> {
  const row = await one<{ n: number }>(
    'SELECT count(*)::int AS n FROM newsletter_subscriber WHERE confirmed IS NOT NULL')
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
 * Marks the issue sent before the first job is queued, so a second click while
 * the first is still going cannot send it twice — a duplicate newsletter is not
 * something an apology fixes. The sending itself goes to the queue: a few
 * hundred SMTP round trips do not belong in a request, and a job per address
 * means one bad mailbox retries alone.
 */
export async function sendIssue(post: PostRow, origin: string): Promise<number> {
  if (post.sent) throw createError({ statusCode: 409, statusMessage: 'already sent' })

  const list = await confirmedSubscribers()

  const claimed = await one<{ id: string }>(
    'UPDATE post SET sent = $2, recipients = $3 WHERE id = $1 AND sent IS NULL RETURNING id',
    [post.id, Date.now(), list.length],
  )
  if (!claimed) throw createError({ statusCode: 409, statusMessage: 'already sent' })

  for (const row of list) {
    await enqueue('newsletter', {
      postId: post.id,
      email: row.email,
      token: row.token,
      origin,
    })
  }

  return list.length
}

/** One issue to one address. Throwing is what puts the job back in the line. */
export async function deliverIssue(postId: string, email: string, token: string, origin: string) {
  const post = await postById(postId)
  if (!post || !email) return

  const mail = renderIssue(post, { origin, token })
  await sendMail(email, mail.subject, mail.html)
}
