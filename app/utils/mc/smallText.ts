export interface SmallCap {
  letter: string
  small: string
  exact: boolean
}

export const SMALL_CAPS: SmallCap[] = [
  { letter: 'A', small: 'ᴀ', exact: true },
  { letter: 'B', small: 'ʙ', exact: true },
  { letter: 'C', small: 'ᴄ', exact: true },
  { letter: 'D', small: 'ᴅ', exact: true },
  { letter: 'E', small: 'ᴇ', exact: true },
  { letter: 'F', small: 'ғ', exact: false },
  { letter: 'G', small: 'ɢ', exact: true },
  { letter: 'H', small: 'ʜ', exact: true },
  { letter: 'I', small: 'ɪ', exact: true },
  { letter: 'J', small: 'ᴊ', exact: true },
  { letter: 'K', small: 'ᴋ', exact: true },
  { letter: 'L', small: 'ʟ', exact: true },
  { letter: 'M', small: 'ᴍ', exact: true },
  { letter: 'N', small: 'ɴ', exact: true },
  { letter: 'O', small: 'ᴏ', exact: true },
  { letter: 'P', small: 'ᴘ', exact: true },
  { letter: 'Q', small: 'ǫ', exact: false },
  { letter: 'R', small: 'ʀ', exact: true },
  { letter: 'S', small: 'ѕ', exact: false },
  { letter: 'T', small: 'ᴛ', exact: true },
  { letter: 'U', small: 'ᴜ', exact: true },
  { letter: 'V', small: 'ᴠ', exact: true },
  { letter: 'W', small: 'ᴡ', exact: true },
  { letter: 'X', small: 'x', exact: false },
  { letter: 'Y', small: 'ʏ', exact: true },
  { letter: 'Z', small: 'ᴢ', exact: true }
]

const ATOMIC: Record<string, string> = { 'Ł': 'ᴌ', 'Ø': 'ø', 'Æ': 'ᴁ', 'Œ': 'ɶ' }

const MAP = new Map(SMALL_CAPS.map(c => [c.letter, c.small]))
const REVERSE = new Map(SMALL_CAPS.map(c => [c.small, c.letter]))

const COMBINING = /[̀-ͯ]/

export const toSmallCaps = (text: string, strip = false) =>
  Array.from(text.normalize('NFD'))
    .map((ch) => {
      if (COMBINING.test(ch)) return strip ? '' : ch
      const up = ch.toUpperCase()
      return ATOMIC[up] ?? MAP.get(up) ?? ch
    })
    .join('')

export const fromSmallCaps = (text: string) =>
  Array.from(text).map(ch => REVERSE.get(ch)?.toLowerCase() ?? ch).join('')

export const SUBSTITUTES = SMALL_CAPS.filter(c => !c.exact)
