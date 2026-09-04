// Connects to the configured SMTP server and authenticates. Sends nothing.
//   pnpm check:smtp
import assert from 'node:assert'
import fs from 'node:fs'
import { createTransport } from 'nodemailer'

// Read `.env` the way the server does, so the check needs no wrapper.
for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  if (!line.includes('=') || line.trimStart().startsWith('#')) continue
  const at = line.indexOf('=')
  const key = line.slice(0, at).trim()
  if (!(key in process.env)) process.env[key] = line.slice(at + 1).trim()
}

const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_PORT, SMTP_SECURE, MAIL_FROM } = process.env
assert.ok(SMTP_HOST && SMTP_USER && SMTP_PASSWORD, 'SMTP_HOST/USER/PASSWORD must all be set')

const port = Number(SMTP_PORT || 465)
await createTransport({
  host: SMTP_HOST,
  port,
  secure: SMTP_SECURE ? SMTP_SECURE === 'true' : port === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
}).verify()

console.info(`ok — ${SMTP_USER} authenticated on ${SMTP_HOST}:${port}, sending as ${MAIL_FROM}`)
