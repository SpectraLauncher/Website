
// The list of Minecraft versions comes from Mojang's own manifest. Mod manifests
// only ever declare a range (">=1.20.1", "[1.20,1.21)", "~1.21"), so without a
// real list there is nothing to resolve a range against — which is why version
// detection could not be finished before this file existed.
const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'

const CACHE_MS = 6 * 60 * 60 * 1000

export interface McVersion {
  id: string
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  released: number
}

interface ManifestBody {
  latest?: { release?: string, snapshot?: string }
  versions?: Array<{ id?: string, type?: string, releaseTime?: string }>
}

let cache: { at: number, versions: McVersion[] } | null = null

// Mojang lists newest first and that order is authoritative — snapshots have no
// numbering that sorts correctly, so we never try to invent one.
export async function minecraftVersions(): Promise<McVersion[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.versions

  const body = await $fetch<ManifestBody>(MANIFEST, { responseType: 'json' })
  const versions = (body.versions ?? [])
    .filter(v => typeof v.id === 'string')
    .map(v => ({
      id: v.id!,
      type: (v.type ?? 'release') as McVersion['type'],
      released: Date.parse(v.releaseTime ?? '') || 0,
    }))

  if (!versions.length) throw createError({ statusCode: 502, statusMessage: 'empty version manifest' })

  cache = { at: Date.now(), versions }
  return versions
}

export function releaseIds(versions: McVersion[]): string[] {
  return versions.filter(v => v.type === 'release').map(v => v.id)
}

export function resetVersionCache() {
  cache = null
}

// Only proper releases get parsed. Snapshots ("24w14a", "1.21-pre1") have no
// ordering that survives arithmetic, so they are never produced by a range —
// a mod that genuinely targets a snapshot gets it picked by hand.
export function parseRelease(id: string): number[] | null {
  if (!/^\d+(\.\d+){0,2}$/.test(id)) return null
  return id.split('.').map(Number)
}

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export function compareReleases(a: string, b: string): number {
  const left = parseRelease(a)
  const right = parseRelease(b)
  if (!left || !right) return a.localeCompare(b)
  return compare(left, right)
}

type Predicate = (version: number[]) => boolean

function bump(version: number[], index: number): number[] {
  const out = version.slice(0, index + 1)
  while (out.length <= index) out.push(0)
  out[index]!++
  return out
}

// One comparison term. Everything here is what mod manifests actually write:
// npm-style operators from fabric.mod.json and Maven ranges from mods.toml.
function term(raw: string): Predicate | null {
  const text = raw.trim()
  if (!text || text === '*' || text === 'any') return () => true

  // Maven: [1.20,1.21) inclusive-exclusive, [1.20.1] exact, [46,) open-ended.
  const maven = /^([[(])\s*([^,\])]*)\s*,?\s*([^,\])]*)\s*([\])])$/.exec(text)
  if (maven) {
    const [, open, lowRaw, highRaw, close] = maven
    const low = lowRaw ? parseRelease(lowRaw.trim()) : null
    const high = highRaw ? parseRelease(highRaw.trim()) : null

    // [1.20.1] with no comma is an exact match, not a range.
    if (!text.includes(',')) {
      return low ? v => compare(v, low) === 0 : null
    }

    return (v) => {
      if (low && (open === '[' ? compare(v, low) < 0 : compare(v, low) <= 0)) return false
      if (high && (close === ']' ? compare(v, high) > 0 : compare(v, high) >= 0)) return false
      return true
    }
  }

  // 1.20.x / 1.20.* — everything inside that minor.
  const wildcard = /^(\d+(?:\.\d+)*)\.[x*]$/.exec(text)
  if (wildcard) {
    const base = parseRelease(wildcard[1]!)!
    const upper = bump(base, base.length - 1)
    return v => compare(v, base) >= 0 && compare(v, upper) < 0
  }

  const op = /^(>=|<=|>|<|=|\^|~)?\s*v?(\d+(?:\.\d+){0,2})$/.exec(text)
  if (!op) return null

  const bound = parseRelease(op[2]!)!
  switch (op[1]) {
    case '>=': return v => compare(v, bound) >= 0
    case '>': return v => compare(v, bound) > 0
    case '<=': return v => compare(v, bound) <= 0
    case '<': return v => compare(v, bound) < 0
    // Semver semantics, which is what the manifests mean by these: ~1.20.1 holds
    // the minor and lets the patch move, ^1.20.1 holds the major. Minecraft is
    // not really semver, but nothing better is on offer.
    case '~': {
      const upper = bump(bound, Math.max(0, bound.length - 2))
      return v => compare(v, bound) >= 0 && compare(v, upper) < 0
    }
    case '^': {
      const upper = bump(bound, 0)
      return v => compare(v, bound) >= 0 && compare(v, upper) < 0
    }
    default: return v => compare(v, bound) === 0
  }
}

// Splits on whitespace and commas, but not inside a Maven bracket — "[1.20,1.21)"
// is one term, and splitting it on the comma is the obvious way to get this wrong.
function splitTerms(group: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0

  for (let i = 0; i < group.length; i++) {
    const ch = group[i]!
    if (ch === '[' || ch === '(') depth++
    else if (ch === ']' || ch === ')') depth--
    else if (depth === 0 && (ch === ',' || /\s/.test(ch))) {
      out.push(group.slice(start, i))
      start = i + 1
    }
  }
  out.push(group.slice(start))

  return out.map(t => t.trim()).filter(Boolean)
}

// Terms separated by space or comma are an AND; `||` is an OR of those groups.
function predicate(range: string): Predicate | null {
  const groups: Predicate[] = []

  for (const group of range.split('||')) {
    const terms = splitTerms(group).map(term)
    if (!terms.length || terms.some(t => t === null)) return null
    groups.push(v => terms.every(t => t!(v)))
  }

  return groups.length ? v => groups.some(g => g(v)) : null
}

// Resolves a declared range into the concrete releases we know about. An
// unparseable range yields an empty list rather than a guess — the admin form
// then asks a human instead of inventing compatibility.
export function expandRange(range: string | null | undefined, available: string[]): string[] {
  if (!range) return []

  const match = predicate(String(range))
  if (!match) return []

  return available.filter((id) => {
    const parsed = parseRelease(id)
    return parsed ? match(parsed) : false
  })
}
