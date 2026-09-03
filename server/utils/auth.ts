
import type { H3Event } from 'h3'
import { betterAuth } from 'better-auth'
import { bearer, captcha, oneTimeToken, twoFactor, username } from 'better-auth/plugins'

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

export function turnstileSiteKey(): string {
  return process.env.TURNSTILE_SECRET_KEY ? (process.env.TURNSTILE_SITE_KEY || '') : ''
}

async function sendMail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.info(`[mail] ${to} — ${subject}\n${html.replace(/<[^>]+>/g, ' ')}`)
    return
  }
  try {
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body: {
        from: process.env.MAIL_FROM || 'Spectra <noreply@makoto.com.pl>',
        to,
        subject,
        html,
        text: html
          .replace(/<head[\s\S]*?<\/head>/i, '')
          .replace(/<div style="display:none[\s\S]*?<\/div>/i, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      },
    })
  } catch (e: any) {
    console.error('[mail] Resend rejected the send:', e?.data?.message || e?.message || e)
  }
}

function mailAssetOrigin() {
  const configured = (process.env.NUXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  return configured && !configured.includes('localhost') ? configured : 'https://usespectra.app'
}

function mailTemplate(opts: {
  preheader: string
  title: string
  body: string
  ctaUrl: string
  ctaLabel: string
  footnote: string
}) {
  const site = mailAssetOrigin()
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#05080f;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${opts.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#05080f;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

      <tr><td align="center" style="padding-bottom:22px;">
        <img src="${site}/logo.png" width="34" height="34" alt=""
             style="vertical-align:middle;border:0;display:inline-block;">
        <span style="display:inline-block;vertical-align:middle;padding-left:10px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;letter-spacing:-.01em;color:#eaf1fb;">
          Spectra<span style="color:#7dd3fc;"> Launcher</span>
        </span>
      </td></tr>

      <tr><td style="background:#0a1120;border:1px solid rgba(125,211,252,.14);border-radius:18px;padding:38px 36px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <h1 style="margin:0 0 12px;font-size:23px;line-height:1.25;font-weight:700;letter-spacing:-.02em;color:#eaf1fb;">${opts.title}</h1>
        <p style="margin:0 0 26px;font-size:15px;line-height:1.65;color:#aab9d0;">${opts.body}</p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center" bgcolor="#38bdf8" style="border-radius:12px;background-image:linear-gradient(135deg,#7dd3fc,#38bdf8 55%,#0ea5e9);">
            <a href="${opts.ctaUrl}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#04121f;text-decoration:none;border-radius:12px;">${opts.ctaLabel}</a>
          </td></tr>
        </table>

        <p style="margin:26px 0 0;font-size:12px;line-height:1.6;color:#64748b;">
          Or paste this link into your browser:<br>
          <a href="${opts.ctaUrl}" style="color:#7dd3fc;word-break:break-all;text-decoration:none;">${opts.ctaUrl}</a>
        </p>

        <div style="height:1px;background:rgba(255,255,255,.08);margin:28px 0 18px;"></div>
        <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">${opts.footnote}</p>
      </td></tr>

      <tr><td align="center" style="padding:22px 8px 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#475569;">
        <a href="${site}" style="color:#64748b;text-decoration:none;">usespectra.app</a>
        &nbsp;·&nbsp; A free, open-source Minecraft launcher.
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`
}

export function useAuth() {
  if (auth) return auth
  const hasMail = !!process.env.RESEND_API_KEY

  auth = betterAuth({
    database: usePool(),
    baseURL: process.env.NUXT_PUBLIC_SITE_URL
      || (import.meta.dev ? 'http://localhost:3000' : 'https://usespectra.app'),
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: hasMail,
      sendResetPassword: async ({ user, url }) => {
        await sendMail(user.email, 'Reset your Spectra password', mailTemplate({
          preheader: 'Set a new password for your Spectra account.',
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
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendMail(user.email, 'Confirm your Spectra account', mailTemplate({
          preheader: 'One click and your Spectra account is ready.',
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
      username(),
      twoFactor({ issuer: 'Spectra Launcher' }),
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
