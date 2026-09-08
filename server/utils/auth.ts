
import type { H3Event } from 'h3'
import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { bearer, captcha, oneTimeToken, organization, twoFactor, username } from 'better-auth/plugins'
import { createTransport } from 'nodemailer'

import { isAdmin } from './admin'
import { catalogIsPublic } from './catalog-gate'
import { usePool } from './db'
import { uniqueUsername } from './username'

let auth: ReturnType<typeof betterAuth> | null = null

function socialProviders() {
  const ids = ['discord', 'google', 'github', 'microsoft'] as const
  const out: Record<string, { clientId: string, clientSecret: string }> = {}
  for (const id of ids) {
    const clientId = process.env[`${id.toUpperCase()}_CLIENT_ID`]
    const clientSecret = process.env[`${id.toUpperCase()}_CLIENT_SECRET`]
    if (clientId && clientSecret) out[id] = { clientId, clientSecret }
  }
  return out
}

export function enabledProviders(): string[] {
  return Object.keys(socialProviders())
}

export function siteOrigin(): string {
  return process.env.NUXT_PUBLIC_SITE_URL
    || (import.meta.dev ? 'http://localhost:3000' : 'https://usespectra.app')
}

// A passkey is bound to this exact domain and stops working if it changes, so a
// malformed site URL must not quietly become some other host. Boot loudly
// instead: an unparseable value is a deployment mistake, not a runtime case.
export function relyingPartyId(): string {
  const origin = siteOrigin()
  try {
    return new URL(origin).hostname
  }
  catch {
    throw new Error(`NUXT_PUBLIC_SITE_URL is not a URL: ${origin}`)
  }
}

export function turnstileSiteKey(): string {
  return process.env.TURNSTILE_SECRET_KEY ? (process.env.TURNSTILE_SITE_KEY || '') : ''
}

let mailer: import('nodemailer').Transporter | null = null

function transport() {
  const host = process.env.SMTP_HOST
  if (!host) return null
  if (mailer) return mailer
  const port = Number(process.env.SMTP_PORT || 465)
  mailer = createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
  })
  return mailer
}

export async function sendMail(to: string, rawSubject: string, html: string) {
  // A line break in a subject line is the start of a second header.
  const subject = rawSubject.replace(/\s+/g, ' ').trim().slice(0, 200)
  const mail = transport()
  if (!mail) {
    console.info(`[mail] ${to} — ${subject}
${html.replace(/<[^>]+>/g, ' ')}`)
    return
  }
  try {
    await mail.sendMail({
      from: process.env.MAIL_FROM || 'Spectra <no-reply@usespectra.app>',
      to,
      subject,
      html,
      text: html
        .replace(/<head[\s\S]*?<\/head>/i, '')
        .replace(/<div style="display:none[\s\S]*?<\/div>/i, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    })
  } catch (e: any) {
    console.error('[mail] SMTP rejected the send:', e?.message || e)
  }
}

export function mailAssetOrigin() {
  const configured = (process.env.NUXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  return configured && !configured.includes('localhost') ? configured : 'https://usespectra.app'
}

// Every caller passes plain sentences, and several of them carry a name typed
// by a person — an account's display name, an organization's name. Escaping
// here rather than at each call site means a new mail cannot forget to do it.
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function mailTemplate(raw: {
  preheader: string
  eyebrow: string
  title: string
  body: string
  ctaUrl: string
  ctaLabel: string
  footnote: string
}) {
  // The address is the one field that must stay a URL; the rest is text.
  const opts = {
    preheader: esc(raw.preheader),
    eyebrow: esc(raw.eyebrow),
    title: esc(raw.title),
    body: esc(raw.body),
    ctaUrl: encodeURI(raw.ctaUrl).replace(/"/g, '%22'),
    ctaLabel: esc(raw.ctaLabel),
    footnote: esc(raw.footnote),
  }

  const site = mailAssetOrigin()
  const sans = `-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`
  const serif = `Georgia,'Iowan Old Style','Times New Roman',serif`
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${opts.title}</title>
<style>
  @media (max-width:620px) {
    .card { padding: 30px 24px !important; }
    .h1 { font-size: 26px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f4f1ea;-webkit-font-smoothing:antialiased;">

<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${opts.preheader}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f1ea" style="background:#f4f1ea;padding:40px 12px 48px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

      <tr><td align="left" style="padding:0 4px 18px;font-family:${sans};">
        <img src="${site}/logo.png" width="26" height="26" alt=""
             style="vertical-align:middle;border:0;border-radius:7px;display:inline-block;">
        <span style="display:inline-block;vertical-align:middle;padding-left:9px;font-size:14px;font-weight:600;letter-spacing:.01em;color:#16181d;">
          Spectra<span style="color:#8a8f9a;font-weight:500;"> Launcher</span>
        </span>
      </td></tr>

      <tr><td bgcolor="#ffffff" style="background:#ffffff;border:1px solid #e5e0d6;border-radius:4px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td height="3" bgcolor="#3b82f6" style="height:3px;line-height:3px;font-size:0;background-color:#3b82f6;background-image:linear-gradient(90deg,#22c55e,#3b82f6 46%,#8b5cf6);">&nbsp;</td></tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="left" class="card" style="padding:42px 46px 40px;font-family:${sans};">

            <p style="margin:0 0 14px;font-family:${sans};font-size:11px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;color:#8a8f9a;">${opts.eyebrow}</p>

            <h1 class="h1" style="margin:0 0 16px;font-family:${serif};font-size:31px;line-height:1.18;font-weight:400;letter-spacing:-.015em;color:#16181d;">${opts.title}</h1>

            <p style="margin:0 0 30px;font-size:15px;line-height:1.68;color:#4a5260;">${opts.body}</p>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr><td align="center" bgcolor="#16181d" style="background:#16181d;border-radius:3px;">
                <a href="${opts.ctaUrl}" style="display:inline-block;padding:14px 30px;font-family:${sans};font-size:14px;font-weight:600;letter-spacing:.01em;color:#ffffff;text-decoration:none;">${opts.ctaLabel} &rarr;</a>
              </td></tr>
            </table>

            <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#8a8f9a;">
              Button not working? Paste this into your browser:<br>
              <a href="${opts.ctaUrl}" style="color:#2450c8;word-break:break-all;text-decoration:none;">${opts.ctaUrl}</a>
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 0;">
              <tr><td height="1" bgcolor="#ece8e0" style="height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr>
            </table>

            <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#8a8f9a;">${opts.footnote}</p>

          </td></tr>
        </table>
      </td></tr>

      <tr><td align="left" style="padding:20px 4px 0;font-family:${sans};font-size:11px;line-height:1.7;color:#9a9689;">
        <a href="${site}" style="color:#6f7480;text-decoration:none;font-weight:600;">usespectra.app</a>
        &nbsp;&middot;&nbsp; A free, open-source platform.
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`
}

export function useAuth() {
  if (auth) return auth
  const hasMail = !!process.env.SMTP_HOST

  auth = betterAuth({
    database: usePool(),
    baseURL: siteOrigin(),
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: hasMail,
      sendResetPassword: async ({ user, url }) => {
        await sendMail(user.email, 'Reset your Spectra password', mailTemplate({
          preheader: 'Set a new password for your Spectra account.',
          eyebrow: 'Password reset',
          title: 'Reset your password',
          body: 'Someone asked to set a new password for your Spectra account. '
            + 'The link below works once and expires in an hour.',
          ctaUrl: url,
          ctaLabel: 'Reset password',
          footnote: 'If this was not you, nothing has changed — you can ignore this message.',
        }))
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // An account that predates the mail setup can no longer sign in, and the
      // sign-up form refuses a known address — without this it has no way out.
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendMail(user.email, 'Confirm your Spectra account', mailTemplate({
          preheader: 'One click and your Spectra account is ready.',
          eyebrow: 'Account verification',
          title: 'Confirm your e-mail',
          body: `Welcome to Spectra${user.name ? `, ${user.name}` : ''}. Confirm this address to finish `
            + 'setting up your account — then you can add friends and share modpacks straight from the launcher.',
          ctaUrl: url,
          ctaLabel: 'Confirm e-mail',
          footnote: 'If you did not create a Spectra account, you can ignore this message.',
        }))
      },
    },
    user: {
      additionalFields: {
        mcUuid: { type: 'string', required: false, input: false },
        mcUsername: { type: 'string', required: false, input: false },
        presence: { type: 'string', required: false, input: false },
        lastSeen: { type: 'number', required: false, input: false },
        playing: { type: 'boolean', required: false, input: false },
        banned: { type: 'boolean', required: false, input: false },
        role: { type: 'string', required: false, input: false },
        partner: { type: 'boolean', required: false, input: false },
        friendsVisibility: { type: 'string', required: false, input: true },
      },
    },
    databaseHooks: {
      user: {
        create: {
          async before(user) {
            const candidate = user as { username?: string | null, name?: string | null, email?: string }
            if (candidate.username) return

            const username = await uniqueUsername(
              candidate.name || candidate.email?.split('@')[0] || 'player')
            return { data: { username, displayUsername: username } }
          },
          async after(user) {
            try {
              await syncBadges({ userId: user.id })
            }
            catch (e) {
              console.error('[badges] sync after signup:', e)
            }
          },
        },
      },
    },
    socialProviders: socialProviders(),
    account: {
      accountLinking: { enabled: true, trustedProviders: ['discord', 'google', 'github', 'microsoft'] },
    },
    plugins: [
      passkey({ rpID: relyingPartyId(), rpName: 'Spectra' }),
      username(),
      twoFactor({ issuer: 'Spectra Launcher' }),
      // Organizacje sa wspolwlascicielem projektow w katalogu — patrz kolumna
      // project.org_id. Zakladanie ich chodzi za ta sama flaga co reszta
      // katalogu, bo inaczej funkcja wyciekalaby uzytkownikom na dlugo przed
      // tym, zanim katalog w ogole zobaczy swiatlo dzienne.
      organization({
        creatorRole: 'owner',
        allowUserToCreateOrganization: async (user) => {
          if (!catalogIsPublic() && !isAdmin(user)) return false
          const state = await limitState(user.id, 'organizations')
          return state.current < state.max
        },
        sendInvitationEmail: async (data) => {
          const site = mailAssetOrigin()
          await sendMail(data.email, `Join ${data.organization.name} on Spectra`, mailTemplate({
            preheader: `${data.inviter.user.name || 'Someone'} invited you to ${data.organization.name}.`,
            eyebrow: 'Organization invite',
            title: `Join ${data.organization.name}`,
            body: `${data.inviter.user.name || 'Someone'} invited you to join `
              + `${data.organization.name} on Spectra as ${data.role}. `
              + 'Accepting lets you publish and manage the projects it owns.',
            ctaUrl: `${site}/org/invite/${data.id}`,
            ctaLabel: 'View invite',
            footnote: 'If you were not expecting this, you can ignore this message — '
              + 'the invite expires on its own.',
          }))
        },
      }),
      bearer(),
      oneTimeToken(),
      ...(process.env.TURNSTILE_SECRET_KEY
        ? [captcha({ provider: 'cloudflare-turnstile', secretKey: process.env.TURNSTILE_SECRET_KEY })]
        : []),
    ],
  })
  return auth
}

export async function requireUser(event: H3Event) {
  const session = await useAuth().api.getSession({ headers: event.headers })
  if (!session?.user) throw createError({ statusCode: 401, statusMessage: 'sign in first' })
  if ((session.user as { banned?: boolean }).banned) {
    throw createError({ statusCode: 403, statusMessage: 'account suspended' })
  }
  return session.user
}

export async function optionalUser(event: H3Event) {
  const session = await useAuth().api.getSession({ headers: event.headers }).catch(() => null)
  return session?.user ?? null
}
