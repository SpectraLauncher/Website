# Spectra — website

The site behind [Spectra Launcher](https://github.com/MakotoPD/Spectra-Launcher):
a landing page for the launcher, 22 browser tools for Minecraft players and
server owners, public player profiles, a badge system, modpack share links and
an admin panel. English and Polish, server-rendered.

Production: <https://usespectra.app>

## Stack

| Layer | Choice |
|---|---|
| Framework | Nuxt 4 (Nitro server, SSR + partial prerender) |
| UI | Nuxt UI 4, Tailwind, GSAP (`v-reveal`), three.js for skin previews |
| State | Pinia |
| Auth | better-auth — email + password, 2FA, username, Discord / Google / GitHub / Microsoft, Turnstile captcha |
| Database | Postgres (`pg` pool, schema created on boot) |
| Storage | Cloudflare R2 via `aws4fetch` |
| i18n | `@nuxtjs/i18n`, `prefix_except_default` — English at `/`, Polish at `/pl` |
| SEO | `@nuxtjs/seo` (robots, sitemap, OG images, schema.org, link checker) + `nuxt-ai-ready` |
| Analytics | self-hosted Umami, no cookies, no consent gate |

## Quick start

```bash
pnpm install
```

Copy `.env.example` to `.env` and fill in at least `DATABASE_URL` and
`BETTER_AUTH_SECRET`, then:

```bash
pnpm dev
```

On boot a Nitro plugin runs the better-auth migrations and `ensureSchema()`,
so an empty Postgres database is enough — no migration step to run by hand.

The production build does **not** read `.env`; pass the variables through the
environment (Docker, systemd unit, hosting panel).

## Environment

| Variable | Needed for |
|---|---|
| `DATABASE_URL` | everything — Postgres connection string |
| `BETTER_AUTH_SECRET` | session signing |
| `NUXT_PUBLIC_SITE_URL` | canonical URLs, sitemap, OG images (defaults to the production domain) |
| `NUXT_PUBLIC_CONTROLLER`, `NUXT_PUBLIC_CONTACT_EMAIL` | the data controller and contact address printed in the legal pages |
| `ADMIN_EMAILS` | comma-separated allowlist for `/admin`; falls back to the owner's address |
| `RESEND_API_KEY`, `MAIL_FROM` | verification and password-reset mail |
| `DISCORD_*`, `GOOGLE_*`, `GITHUB_*`, `MICROSOFT_*` | social sign-in |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | avatars, badge art, shared modpacks |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | captcha on sign-up |
| `SPECTRA_INGEST_KEY` | soft key the launcher sends with anonymous telemetry |
| `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` | the Discord tab in the admin panel |
| `GITHUB_WEBHOOK_SECRET` | release webhook that announces new launcher versions |
| `NUXT_PUBLIC_UMAMI_SRC`, `NUXT_PUBLIC_UMAMI_ID` | analytics; omit and no script is injected |

`R2_PUBLIC_URL` must be the public CDN domain (`https://cdn.…`), not the S3
signing endpoint — files served from the signing endpoint 403 in the browser.

## Layout

```
app/
├── components/       shared UI, skin viewers/editors, Discord builders
├── composables/      auth client, launcher version, tool SEO
├── middleware/       admin.ts — server-checked gate for /admin
├── pages/            routes (see below)
├── utils/            pure logic per tool, auto-imported
└── error.vue         one page for 404 / 403 / 401 / 5xx
server/
├── api/              REST endpoints (accounts, friends, shares, badges, admin)
├── routes/render/    the public player-render image API
└── utils/            db pool, schema, auth, r2, badges, admin gate
i18n/locales/         en.json, pl.json — every string, both files always
test/                 runnable checks, one per subsystem
```

### Routes

| Path | What |
|---|---|
| `/` | landing page |
| `/launcher` | launcher page: features, screenshots, all installers, FAQ |
| `/tools` + `/tools/<id>` | 22 tools (colour codes, MOTD, gradients, banners, skin editor, poses, XP, coordinates, …) |
| `/badges`, `/badges/<slug>` | badge list and per-badge holders |
| `/u/<username>` | public profile: render, badges, capes, stats, activity graph |
| `/s/<code>` | shared modpack landing page |
| `/account` | profile, friends, security, connected accounts, privacy |
| `/admin` | stats, users, shares, badges, Discord — allowlisted accounts only |
| `/privacy`, `/terms`, `/cookies` | legal pages, rendered from i18n |
| `/secret` | badge code entry |

## Player render API

Public, cached, hotlinkable — the launcher and the profile pages both use it.

```
GET /render/<pose>/<player>/<crop>
```

`<player>` is a username or UUID. 29 poses (`default`, `walking`, `sleeping`,
`hero`, `flexing`, …) and the crops `full`, `bust`, `face`, `head`,
`processed`, `barebones`.

| Query | Range | Meaning |
|---|---|---|
| `size` | 16–1024 | output size in pixels |
| `light` | `flat`, `studio`, `soft`, `dramatic`, `sunset`, `night` | three-point lighting rig |
| `fx` | `none`, `comic`, `statue`, `ice`, `hologram`, `plastic` | post effect |
| `rim` | 0–200 | rim light strength, percent |
| `yaw`, `pitch` | ±360 / ±89 | camera angles |
| `cape`, `voxel` | flag | draw the cape, draw 3D overlay layers |
| `nametag` | text or `1` | floating name above the head |

```
/render/hero/makotopd/full?size=512&light=studio&rim=35&cape=1
```

Skins come from Mojang, resolved through a deduplicated cache — a page with
thirty renders makes one profile lookup per player, not thirty.

## Launcher integration

The desktop launcher talks to these endpoints; the contract is documented on
the launcher side in `docs/ARCHITECTURE.md`.

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/one-time-token/verify` | exchanges the token from the `spectra://auth/…` deep link for a bearer session |
| `POST /api/me/minecraft` | links the Minecraft profile (token is verified against Mojang, never stored) |
| `POST /api/me/activity` | daily launches and playtime — incremental, capped at one hour per call |
| `POST /api/presence`, `GET /api/notifications?playing=1` | online status and "in game" |
| `POST /api/telemetry` | anonymous install-level counters, no account attached |

Account activity and anonymous telemetry live in separate tables on purpose and
must never be joined — the privacy policy promises exactly that.

## Badges

A badge row carries its own award rule, so a badge can be added after the fact
and back-fills whoever qualifies. Rules are one SQL predicate each over a shared
per-account stats view (`server/utils/badges.ts`): signup rank, join date,
account age, Minecraft nick length or pattern, launches, longest daily streak,
active days, playtime hours, friends, shared packs, downloads, plus manual and
secret-code awards. `syncBadges()` runs on sign-up, on Minecraft link, on every
launcher launch, on badge save, and from the panel's **Przelicz** button.

## Checks

Every subsystem has one runnable check; none of them need a browser, and only
two touch the network.

```bash
pnpm check:sql          # no value is ever spliced into SQL
pnpm check:autoimport   # every util export is visible to Nuxt's scanner
pnpm check:badges       # every badge rule plans against the real database
pnpm check:seo          # titles, canonical, hreflang, schema, og:image, sitemap, robots
pnpm check:poses        # pose maths, crops, mitre seams
pnpm check:skin         # skin parsing, legacy conversion, cape layouts
```

The rest: `check:social`, `check:username`, `check:discord`, `check:colors`,
`check:locator`, `check:smalltext`, `check:gradient`, `check:banner`,
`check:tellraw`, `check:armordye`, `check:coords`, `check:display`,
`check:potion`, `check:rank`, `check:head`, `check:xp`, `check:circle`,
`check:ticks`, `check:anim`, `check:motd`, `check:startfile`.

`check:seo` needs a running server (`pnpm dev`), `check:badges` needs
`DATABASE_URL`. Everything else reads files and talks to nothing.

## Build and deploy

```bash
pnpm build
node .output/server/index.mjs
```

The build prerenders the tool and legal pages (both locales) and fails on a
prerender error, so a broken page cannot ship as static HTML. A `Dockerfile` is
included.

## Conventions

- **No comments in application code.** `.vue`, `.ts` and `.json` say what they
  do through naming; explanations belong in commit messages and here. The one
  exception is the `sql-safe:` marker, which `check:sql` reads.
- **Both locales, always.** A new key goes into `en.json` *and* `pl.json`.
  Never write an `@` inside a translation — vue-i18n treats it as linked-message
  syntax and eats it; the legal pages substitute `%CONTROLLER%` and `%EMAIL%`
  after translation for that reason.
- **Watch single-line exports.** Nuxt's auto-import scanner is regex-based and
  a one-line `export const X = { … }` can hide the export directly below it.
  The build still succeeds and the page fails in the browser with
  "X is not defined" — `pnpm check:autoimport` catches it.
- **Admin returns 404, not 403.** The panel does not confirm its own existence
  to accounts that cannot use it.
