export interface McColor {
  code: string
  name: string
  hex: string
  shadow: string
}

export interface McFormat {
  code: string
  key: 'bold' | 'italic' | 'underline' | 'strike' | 'obfuscated' | 'reset'
  icon: string
}

export const MC_COLORS: McColor[] = [
  { code: '0', name: 'Black', hex: '#000000', shadow: '#000000' },
  { code: '1', name: 'Dark Blue', hex: '#0000AA', shadow: '#00002A' },
  { code: '2', name: 'Dark Green', hex: '#00AA00', shadow: '#002A00' },
  { code: '3', name: 'Dark Aqua', hex: '#00AAAA', shadow: '#002A2A' },
  { code: '4', name: 'Dark Red', hex: '#AA0000', shadow: '#2A0000' },
  { code: '5', name: 'Dark Purple', hex: '#AA00AA', shadow: '#2A002A' },
  { code: '6', name: 'Gold', hex: '#FFAA00', shadow: '#2A2A00' },
  { code: '7', name: 'Gray', hex: '#AAAAAA', shadow: '#2A2A2A' },
  { code: '8', name: 'Dark Gray', hex: '#555555', shadow: '#151515' },
  { code: '9', name: 'Blue', hex: '#5555FF', shadow: '#15153F' },
  { code: 'a', name: 'Green', hex: '#55FF55', shadow: '#153F15' },
  { code: 'b', name: 'Aqua', hex: '#55FFFF', shadow: '#153F3F' },
  { code: 'c', name: 'Red', hex: '#FF5555', shadow: '#3F1515' },
  { code: 'd', name: 'Light Purple', hex: '#FF55FF', shadow: '#3F153F' },
  { code: 'e', name: 'Yellow', hex: '#FFFF55', shadow: '#3F3F15' },
  { code: 'f', name: 'White', hex: '#FFFFFF', shadow: '#3F3F3F' }
]

export const MC_FORMATS: McFormat[] = [
  { code: 'l', key: 'bold', icon: 'i-lucide-bold' },
  { code: 'o', key: 'italic', icon: 'i-lucide-italic' },
  { code: 'n', key: 'underline', icon: 'i-lucide-underline' },
  { code: 'm', key: 'strike', icon: 'i-lucide-strikethrough' },
  { code: 'k', key: 'obfuscated', icon: 'i-lucide-shuffle' },
  { code: 'r', key: 'reset', icon: 'i-lucide-rotate-ccw' }
]

const BY_HEX = new Map(MC_COLORS.map(c => [c.hex.toLowerCase(), c]))

export const colorFromHex = (hex?: string | null) =>
  hex ? BY_HEX.get(hex.toLowerCase()) : undefined

export interface McRun {
  text: string
  color?: McColor
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  obfuscated?: boolean
}

interface JsonMark { type: string, attrs?: { color?: string } }
interface JsonNode { type: string, text?: string, marks?: JsonMark[], content?: JsonNode[] }

export function docToRuns(doc: JsonNode | undefined): McRun[][] {
  if (!doc?.content) return [[]]

  return doc.content.map((block) => {
    if (!block.content) return []
    return block.content
      .filter(node => node.type === 'text' && node.text)
      .map((node) => {
        const marks = node.marks || []
        const has = (t: string) => marks.some(m => m.type === t)
        return {
          text: node.text!,
          color: colorFromHex(marks.find(m => m.type === 'textStyle')?.attrs?.color),
          bold: has('bold'),
          italic: has('italic'),
          underline: has('underline'),
          strike: has('strike'),
          obfuscated: has('obfuscated')
        }
      })
  })
}

export function runsToCodes(lines: McRun[][], symbol: '§' | '&'): string {
  return lines.map((runs) => {
    let dirty = false

    return runs.map((run) => {
      const formats = [
        run.bold && 'l',
        run.italic && 'o',
        run.underline && 'n',
        run.strike && 'm',
        run.obfuscated && 'k'
      ].filter(Boolean) as string[]

      let out = ''
      if (run.color) out += symbol + run.color.code
      else if (dirty) out += symbol + 'r'

      out += formats.map(f => symbol + f).join('')
      dirty = Boolean(run.color) || formats.length > 0

      return out + run.text
    }).join('')
  }).join('\n')
}

export const mcColorHex = (color: string) => {
  if (!color) return '#FFFFFF'
  if (color.startsWith('#')) return color
  const key = color.toLowerCase()
  return MC_COLORS.find(c => c.name.toLowerCase().replace(/ /g, '_') === key)?.hex || '#FFFFFF'
}
