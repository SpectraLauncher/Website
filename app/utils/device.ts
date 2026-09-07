// The string a browser sends is long and mostly noise; the pieces a person uses
// to recognise their own device in a session list are the platform and the
// engine. Returns null for either part it cannot name, so the caller decides
// what to show when nothing matches.
//
// To add a browser or a platform: one entry in the matching list. Order matters
// where one agent contains another — Edge and Opera both claim to be Chrome.
const PLATFORMS: Array<[RegExp, string]> = [
  [/Windows/i, 'Windows'],
  [/Android/i, 'Android'],
  [/iPhone|iPad|iPod|iOS/i, 'iOS'],
  [/Mac OS X|Macintosh/i, 'macOS'],
  [/Linux/i, 'Linux'],
]

const BROWSERS: Array<[RegExp, string]> = [
  [/Edg\//i, 'Edge'],
  [/OPR\/|Opera/i, 'Opera'],
  [/Firefox/i, 'Firefox'],
  [/Chrome/i, 'Chrome'],
  [/Safari/i, 'Safari'],
]

function first(agent: string, table: Array<[RegExp, string]>): string | null {
  return table.find(([pattern]) => pattern.test(agent))?.[1] ?? null
}

export function describeAgent(agent?: string | null): string | null {
  if (!agent) return null

  const parts = [first(agent, BROWSERS), first(agent, PLATFORMS)].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}
