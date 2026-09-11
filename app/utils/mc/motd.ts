import type { McRun } from './mcColors.ts'
import { runsToCodes, MC_COLORS } from './mcColors.ts'

export const MOTD_LINES = 2
export const MOTD_LINE_LENGTH = 45

export const motdRaw = (lines: McRun[][]) =>
  runsToCodes(lines.slice(0, MOTD_LINES), '§')

export const motdProperties = (raw: string) =>
  raw.replace(/§/g, '\\u00A7').replace(/\n/g, '\\n')

export const visibleLength = (runs: McRun[]) =>
  runs.reduce((n, r) => n + Array.from(r.text).length, 0)

export const isOverflowing = (runs: McRun[]) => visibleLength(runs) > MOTD_LINE_LENGTH

export function parseMotd(raw: string): McRun[][] {
  return raw.split(/\r?\n|\\n/).slice(0, MOTD_LINES).map((line) => {
    const runs: McRun[] = []
    let current: McRun = { text: '' }

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!

      if ((ch === '§' || ch === '&') && i + 1 < line.length) {
        const code = line[i + 1]!.toLowerCase()
        const color = MC_COLORS.find(c => c.code === code)

        if (color || 'lonmkr'.includes(code)) {
          if (current.text) runs.push(current)

          current = code === 'r'
            ? { text: '' }
            : { ...current, text: '' }

          if (color) {
            current = { text: '', color }
          } else if (code === 'l') current.bold = true
          else if (code === 'o') current.italic = true
          else if (code === 'n') current.underline = true
          else if (code === 'm') current.strike = true
          else if (code === 'k') current.obfuscated = true

          i++
          continue
        }
      }

      current.text += ch
    }

    if (current.text) runs.push(current)
    return runs
  })
}
