// All security headers in one place. They used to sit in `routeRules`, but the
// CSP has to name the analytics origin, which is only known at run time.
//
// `script-src` still needs 'unsafe-inline': Nuxt emits inline bootstrap and
// colour-mode scripts, and there is no nonce support without pulling in
// nuxt-security. The directive is still worth having — it stops a script from
// being loaded off an attacker-chosen host, which is the common case — but it
// is weaker than the launcher's CSP in tauri.conf.json.
//
// 'unsafe-inline' is the ceiling here. Add nuxt-security for nonces
// if inline-script injection ever becomes a realistic risk.

const TURNSTILE = 'https://challenges.cloudflare.com'

// Connect embedded components load Connect.js and render themselves inside
// Stripe-owned iframes, so both origins are needed as script and frame sources.
//
// Stripe also documents a style-src hash for an empty style element. It is
// deliberately not added: style-src here carries 'unsafe-inline', and a browser
// ignores 'unsafe-inline' for any directive that also lists a hash, so adding it
// would switch off every inline style on the site to permit one.
//
// Cross-Origin-Opener-Policy must stay at its default of unsafe-none. Setting it
// to same-origin breaks the sign-in popup onboarding needs, which is why this
// file does not set it at all.
const STRIPE = 'https://connect-js.stripe.com https://js.stripe.com'

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
    `script-src 'self' 'unsafe-inline' ${TURNSTILE} ${STRIPE}${extra}`,
    `style-src 'self' 'unsafe-inline'`,
    // Avatars come from R2, Discord, Google, GitHub and Mojang; skins and heads
    // from textures.minecraft.net and mc-heads.net. Enumerating them would break
    // on the next OAuth provider, so images are allowed from any https origin.
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    // Stripe documents script-src, frame-src, img-src and style-src for embedded
    // components, but not this one. Connect.js still fetches its own source map
    // from the top-level context, which connect-src governs — so without the
    // origins here the page logs a CSP violation on every visit.
    `connect-src 'self' ${TURNSTILE} ${STRIPE}${extra}`,
    `frame-src ${TURNSTILE} ${STRIPE}`,
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
    // payment=() switches off the Payment Request API outright, which is what
    // Google Pay and Apple Pay inside Stripe's Payment Element are. The wallet
    // buttons simply do not appear, and the console says only "payment is not
    // allowed in this document". Allowed for this origin and for Stripe's frame,
    // and for nothing else.
    'permissions-policy':
      'camera=(), microphone=(), geolocation=(), '
      + 'payment=(self "https://js.stripe.com")',
    'content-security-policy': policy(),
  })
})
