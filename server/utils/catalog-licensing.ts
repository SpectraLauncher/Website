
import { LICENSES, type License } from './catalog-types'

// Selling is never blocked here — the seller declares authorship and carries the
// consequences. What this does is tell them, before they set a price, what the
// licence they picked actually obliges them to.
export type SaleNoteLevel = 'none' | 'obligation' | 'conflict'

export interface SaleNote {
  level: SaleNoteLevel
  // A translation key with its parameters, never a sentence: a message written
  // here could only ever exist in one language.
  code: string
  params: Record<string, string>
}

// Forbids commercial use outright. Selling one of these is the seller putting
// themselves in breach unless they hold the rights some other way.
const NON_COMMERCIAL: readonly string[] = ['CC-BY-NC-SA-4.0']

// Permits sale, but the buyer gains rights the seller cannot take back: the
// source has to be available to them, and they may redistribute it.
const COPYLEFT: readonly string[] = [
  'GPL-3.0-only',
  'LGPL-3.0-only',
  'LGPL-2.1-only',
  'MPL-2.0',
  'CC-BY-SA-4.0',
]

export function allowsCommercialUse(license: string | null): boolean {
  return !license || !NON_COMMERCIAL.includes(license)
}

export function saleNote(license: string | null): SaleNote {
  if (!license || license === 'other') {
    return { level: 'obligation', code: 'catalog.sale.unknownLicense', params: {} }
  }

  if (NON_COMMERCIAL.includes(license)) {
    return { level: 'conflict', code: 'catalog.sale.nonCommercial', params: { license } }
  }

  if (COPYLEFT.includes(license)) {
    return { level: 'obligation', code: 'catalog.sale.copyleft', params: { license } }
  }

  return { level: 'none', code: '', params: {} }
}

// The wording someone agrees to when they publish. Stored with the project by
// its identifier, so a later change to this text does not silently rewrite what
// past sellers were shown.
export const AUTHORSHIP_TERMS = 'authorship-v1'

export function isKnownLicense(value: unknown): value is License {
  return LICENSES.includes(value as License)
}
