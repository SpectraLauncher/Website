// All security headers in one place. They used to sit in `routeRules`, but the
// CSP has to name the analytics origin, which is only known at run time.
//
// `script-src` still needs 'unsafe-inline': Nuxt emits inline bootstrap and
// colour-mode scripts, and there is no nonce support without pulling in
// nuxt-security. The directive is still worth having — it stops a script from
// being loaded off an attacker-chosen host, which is the common case — but it
// is weaker than the launcher's CSP in tauri.conf.json.
//
// ponytail: 'unsafe-inline' is the ceiling here. Add nuxt-security for nonces
// if inline-script injection ever becomes a realistic risk.

const TURNSTILE = 'https://challenges.cloudflare.com'

function originOf(url: string): string | null {
  try {
    return url ? new URL(url).origin : null
  } catch {
    return null
  }
}

let cached: string | null = null

function policy(): string {
  if (cached) return cached

  const umami = originOf(String(useRuntimeConfig().public.umamiSrc || ''))
  const extra = umami ? ` ${umami}` : ''

  cached = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'self'`,
    `form-action 'self'`,
    `script-src 'self' 'unsafe-inline' ${TURNSTILE}${extra}`,
    `style-src 'self' 'unsafe-inline'`,
    // Avatars come from R2, Discord, Google, GitHub and Mojang; skins and heads
    // from textures.minecraft.net and mc-heads.net. Enumerating them would break
    // on the next OAuth provider, so images are allowed from any https origin.
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' ${TURNSTILE}${extra}`,
    `frame-src ${TURNSTILE}`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
  ].join('; ')

  return cached
}

export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'content-security-policy': policy(),
  })
})
