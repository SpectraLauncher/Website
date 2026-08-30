// CurseForge proxy rules. The key used to be compiled into the launcher, where
// `strings` pulls it straight back out and CurseForge's terms are broken by
// construction. It lives on the server now, and the launcher calls this route.
//
// Only the endpoints the launcher actually uses are forwarded — this is not a
// general-purpose tunnel to api.curseforge.com.

export const CURSEFORGE_UPSTREAM = 'https://api.curseforge.com/v1'

const NUMERIC = /^\d{1,12}$/

export function allowedCurseforge(method: string, segments: string[]): boolean {
  const [a, b, c, d] = segments

  if (method === 'GET') {
    if (segments.length === 1 && a === 'categories') return true
    if (segments.length === 2 && a === 'mods' && b === 'search') return true
    if (segments.length === 2 && a === 'mods' && NUMERIC.test(b!)) return true
    if (segments.length === 3 && a === 'mods' && NUMERIC.test(b!)
      && (c === 'description' || c === 'files')) return true
    if (segments.length === 4 && a === 'mods' && NUMERIC.test(b!) && c === 'files'
      && NUMERIC.test(d!)) return true
    return false
  }

  if (method === 'POST') {
    if (segments.length === 1 && (a === 'fingerprints' || a === 'mods')) return true
    if (segments.length === 2 && a === 'mods' && b === 'files') return true
  }

  return false
}
