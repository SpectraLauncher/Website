
import en from '../../i18n/locales/en.json'
import pl from '../../i18n/locales/pl.json'

// The same strings the interface uses, so an e-mail never drifts from what the
// bell says. Bundled rather than read from disk because Nitro ships without the
// source tree next to it.
//
// To add a language: one import, one entry here, and the locale in nuxt.config.
const DICTIONARIES: Record<string, unknown> = { en, pl }

export const MAIL_LOCALES = Object.keys(DICTIONARIES)

export const DEFAULT_LOCALE = 'en'

export function localeOrDefault(value: unknown): string {
  return typeof value === 'string' && value in DICTIONARIES ? value : DEFAULT_LOCALE
}

function lookup(dict: unknown, key: string): string | null {
  let node: unknown = dict
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return null
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : null
}

// Vue-i18n's {name} placeholders, and nothing else — an e-mail has no need for
// plurals or dates, and every message it sends is a single sentence.
export function translate(
  locale: string,
  key: string,
  params: Record<string, string | number> = {},
): string {
  const chosen = localeOrDefault(locale)
  const text = lookup(DICTIONARIES[chosen], key)
    ?? lookup(DICTIONARIES[DEFAULT_LOCALE], key)
    ?? key

  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    (name in params ? String(params[name]) : whole))
}
