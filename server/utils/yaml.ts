
export type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue }

function scalar(raw: string): YamlValue {
  const value = raw.trim()
  if (!value || value === '~' || value === 'null') return null
  if (value === 'true' || value === 'yes') return true
  if (value === 'false' || value === 'no') return false

  if ((value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }

  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim()
    return inner ? inner.split(',').map(part => scalar(part)) : []
  }

  if (/^-?\d+$/.test(value)) return Number(value)
  return value
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length
}

// The subset of YAML a plugin descriptor uses: flat keys, nested maps, block
// lists and inline lists. Written by hand for the same reason as the TOML
// reader — this is the only place YAML appears, and only a sliver of it is used.
//
// Anything outside that subset (anchors, multi-line scalars, documents) is left
// as a string rather than guessed at.
export function parseYaml(source: string): Record<string, YamlValue> {
  const lines = source.split(/\r?\n/)
    .filter(line => line.trim() && !line.trimStart().startsWith('#'))

  function block(start: number, indent: number): [Record<string, YamlValue>, number] {
    const out: Record<string, YamlValue> = {}
    let i = start

    while (i < lines.length) {
      const line = lines[i]!
      const depth = indentOf(line)
      if (depth < indent) break

      const trimmed = line.trim()
      const colon = trimmed.indexOf(':')
      if (colon < 1) {
        i++
        continue
      }

      const key = trimmed.slice(0, colon).trim()
      const rest = trimmed.slice(colon + 1).trim()

      if (rest) {
        out[key] = scalar(rest)
        i++
        continue
      }

      const next = lines[i + 1]
      if (next && next.trim().startsWith('- ') && indentOf(next) > depth) {
        const items: YamlValue[] = []
        i++
        while (i < lines.length && lines[i]!.trim().startsWith('- ')
          && indentOf(lines[i]!) > depth) {
          items.push(scalar(lines[i]!.trim().slice(2)))
          i++
        }
        out[key] = items
        continue
      }

      if (next && indentOf(next) > depth) {
        const [nested, consumed] = block(i + 1, indentOf(next))
        out[key] = nested
        i = consumed
        continue
      }

      out[key] = null
      i++
    }

    return [out, i]
  }

  return block(0, 0)[0]
}

export function yamlString(value: YamlValue | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function yamlList(value: YamlValue | undefined): string[] {
  if (typeof value === 'string') return [value.trim()].filter(Boolean)
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string').map(v => v.trim()).filter(Boolean)
}
