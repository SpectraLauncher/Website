
// Podzbior TOML-a, ktorego uzywaja mods.toml i neoforge.mods.toml: pary
// klucz-wartosc, tablice tabel [[mods]] i [[dependencies.modid]], stringi w
// cudzyslowie i apostrofie, w tym wielolinijkowe.
//
// Wlasny zamiast biblioteki, bo to jedyne miejsce w projekcie, gdzie TOML w
// ogole wystepuje, i uzywamy z niego moze pieciu procent. Czego tu nie ma —
// daty, tablice inline zagniezdzone, tabele inline — nie pojawia sie w plikach
// modow; jesli sie pojawi, parser zwroci to jako string zamiast zgadywac.

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

// Przecinki wewnatrz stringow nie rozdzielaja elementow tablicy.
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

    // Stringi wielolinijkowe i tablice rozbite na kilka linii — zbieramy do
    // momentu, w ktorym wartosc sie domyka.
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

// --- MANIFEST.MF ---------------------------------------------------------

// Forge wpisuje w mods.toml `version = "${file.jarVersion}"` i podstawia
// prawdziwa wersje z manifestu dopiero przy ladowaniu, wiec bez tego pliku
// wersji modu po prostu nie ma.
//
// Manifest lamie linie po 72 bajtach, a kontynuacja zaczyna sie od spacji —
// naiwne dzielenie po dwukropku gubi konce dluzszych wartosci.
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
