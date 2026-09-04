
// The subset of TOML that mods.toml and neoforge.mods.toml actually use:
// key-value pairs, arrays of tables ([[mods]], [[dependencies.modid]]) and
// quoted strings, including multi-line ones.
//
// Written by hand rather than pulled from a library because this is the only
// place in the project where TOML appears at all, and we use maybe five percent
// of it. What is missing here — dates, nested inline arrays, inline tables —
// does not occur in mod files; if it ever does, the parser returns it as a
// string rather than guessing.

export type TomlValue = string | number | boolean | TomlValue[] | TomlTable
export interface TomlTable { [key: string]: TomlValue }

function unquote(raw: string): string {
  const value = raw.trim()

  if (value.startsWith('"""')) return value.slice(3, -3).replace(/^\r?\n/, '')
  if (value.startsWith("'''")) return value.slice(3, -3).replace(/^\r?\n/, '')

  if (value.startsWith('"')) {
    return value.slice(1, -1)
      .replace(/\\n/g, '\n').replace(/\\t/g, '\t')
      .replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  if (value.startsWith("'")) return value.slice(1, -1)

  return value
}

function scalar(raw: string): TomlValue {
  const value = raw.trim()

  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim()
    if (!inner) return []
    return splitTopLevel(inner).map(part => scalar(part))
  }

  if (value === 'true') return true
  if (value === 'false') return false

  if (/^[+-]?\d+$/.test(value)) return Number(value)
  if (/^[+-]?\d*\.\d+$/.test(value)) return Number(value)

  return unquote(value)
}

// Commas inside strings do not separate array elements.
function splitTopLevel(input: string): string[] {
  const out: string[] = []
  let depth = 0
  let quote: string | null = null
  let start = 0

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!
    if (quote) {
      if (ch === quote && input[i - 1] !== '\\') quote = null
      continue
    }
    if (ch === '"' || ch === '\'') quote = ch
    else if (ch === '[') depth++
    else if (ch === ']') depth--
    else if (ch === ',' && depth === 0) {
      out.push(input.slice(start, i))
      start = i + 1
    }
  }

  const tail = input.slice(start).trim()
  if (tail) out.push(tail)
  return out
}

function descend(root: TomlTable, path: string[]): TomlTable {
  let at = root
  for (const key of path) {
    const next = at[key]
    if (Array.isArray(next)) {
      const last = next.at(-1)
      at = (typeof last === 'object' && !Array.isArray(last) ? last : {}) as TomlTable
    } else if (next && typeof next === 'object') {
      at = next as TomlTable
    } else {
      const created: TomlTable = {}
      at[key] = created
      at = created
    }
  }
  return at
}

function splitPath(header: string): string[] {
  return header.split('.').map(part => unquote(part.trim()))
}

export function parseToml(source: string): TomlTable {
  const root: TomlTable = {}
  let table = root

  const lines = source.split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (!line || line.startsWith('#')) continue

    const arrayHeader = /^\[\[(.+?)\]\]$/.exec(line)
    if (arrayHeader) {
      const path = splitPath(arrayHeader[1]!)
      const key = path.pop()!
      const parent = descend(root, path)
      const list = Array.isArray(parent[key]) ? parent[key] as TomlValue[] : (parent[key] = [])
      table = {}
      list.push(table)
      continue
    }

    const tableHeader = /^\[(.+?)\]$/.exec(line)
    if (tableHeader) {
      const path = splitPath(tableHeader[1]!)
      const key = path.pop()!
      const parent = descend(root, path)
      const existing = parent[key]
      table = (existing && typeof existing === 'object' && !Array.isArray(existing)
        ? existing
        : (parent[key] = {})) as TomlTable
      continue
    }

    const eq = line.indexOf('=')
    if (eq < 1) continue

    const key = unquote(line.slice(0, eq).trim())
    let raw = line.slice(eq + 1).trim()

    // Multi-line strings and arrays split across lines — keep collecting until
    // the value closes.
    const opener = raw.startsWith('"""') ? '"""' : raw.startsWith("'''") ? "'''" : null
    if (opener) {
      while (!(raw.length > opener.length * 2 - 1 && raw.endsWith(opener)) && i + 1 < lines.length) {
        raw += `\n${lines[++i]!}`
      }
    } else if (raw.startsWith('[') && !raw.endsWith(']')) {
      while (!raw.endsWith(']') && i + 1 < lines.length) raw += lines[++i]!.trim()
    }

    table[key] = scalar(raw)
  }

  return root
}

// Forge writes `version = "${file.jarVersion}"` into mods.toml and substitutes
// the real version from the manifest only at load time, so without this file
// there simply is no mod version.
//
// The manifest wraps lines at 72 bytes and a continuation starts with a space —
// naive splitting on the colon loses the tail of longer values.
export function parseManifest(source: string): Record<string, string> {
  const out: Record<string, string> = {}
  let lastKey: string | null = null

  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith(' ') && lastKey) {
      out[lastKey] += line.slice(1)
      continue
    }
    const colon = line.indexOf(':')
    if (colon < 1) {
      lastKey = null
      continue
    }
    lastKey = line.slice(0, colon).trim()
    out[lastKey] = line.slice(colon + 1).trim()
  }

  return out
}
