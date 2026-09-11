import { fromHex, toRgb, toHex } from './rgb.ts'
import { toSmallCaps } from './smallText.ts'

export type RankStyle = 'classic' | 'small' | 'compact' | 'bold' | 'big' | 'outline'
export type IconMode = 'joined' | 'separate'
export type PreviewMode = 'studio' | 'chat' | 'tab'

export const RANK_STYLES: RankStyle[] = ['classic', 'small', 'compact', 'bold', 'big', 'outline']
export const ICON_MODES: IconMode[] = ['joined', 'separate']
export const PREVIEW_MODES: PreviewMode[] = ['studio', 'chat', 'tab']

export interface RankStyleSpec {
  id: RankStyle
  scale: number
  bold: boolean
  spacing: number
  outline: number
  smallCaps?: boolean
}

export const GRID = 9
export const GLYPH_H = 7
export const SUPERSAMPLE = 8
export const MAX_LABEL = 24

export const STYLE_SPECS: Record<RankStyle, RankStyleSpec> = {
  classic: { id: 'classic', scale: 1, bold: false, spacing: 0, outline: 0 },
  small: { id: 'small', scale: 1, bold: false, spacing: 0, outline: 0, smallCaps: true },
  compact: { id: 'compact', scale: 1, bold: false, spacing: -1, outline: 0 },
  bold: { id: 'bold', scale: 1, bold: true, spacing: 1, outline: 0 },
  big: { id: 'big', scale: 2, bold: false, spacing: 0, outline: 0 },
  outline: { id: 'outline', scale: 1, bold: false, spacing: 1, outline: 1 }
}

export const ICON_PALETTE: Record<string, string> = {
  y: '#FACC15',
  o: '#A16207',
  r: '#EF4444',
  d: '#991B1B',
  b: '#3B82F6',
  c: '#38BDF8',
  s: '#E2E8F0',
  g: '#64748B',
  e: '#F97316',
  n: '#4ADE80',
  p: '#C084FC',
  w: '#FFFFFF',
  k: '#1E293B'
}

export interface RankIcon {
  id: string
  rows: string[]
}

export const RANK_ICONS: RankIcon[] = [
  { id: 'crown', rows: ['.......', 'y..y..y', 'y.yyy.y', 'yyyyyyy', 'yryryry', 'yyyyyyy', '.......'] },
  { id: 'star', rows: ['...y...', '..yyy..', 'yyyyyyy', '.yyyyy.', '..y.y..', '.y...y.', '.......'] },
  { id: 'shield', rows: ['sssssss', 'sbbbbbs', 'sbwbwbs', '.sbbbs.', '..sbs..', '...s...', '.......'] },
  { id: 'sword', rows: ['.....ss', '....sss', '...sss.', '.gsss..', 'ggss...', 'og.....', '.......'] },
  { id: 'gem', rows: ['.ccccc.', 'cwcccbc', 'ccwcbcc', '.ccccc.', '..cbc..', '...b...', '.......'] },
  { id: 'bolt', rows: ['...yyy.', '..yyy..', '.yyyyy.', '...yy..', '..yy...', '.yy....', '.y.....'] },
  { id: 'flame', rows: ['..r....', '.rer...', 'reyer..', 'reyyer.', '.reyer.', '..rrr..', '.......'] },
  { id: 'heart', rows: ['.rr.rr.', 'rwrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...', '.......'] },
  { id: 'trophy', rows: ['yyyyyyy', 'y.yyy.y', '.yyryy.', '...y...', '...y...', '..yyy..', '.yyyyy.'] },
  { id: 'leaf', rows: ['....nn.', '..nnnn.', '.nnnnn.', 'nnnnnn.', '.nnnn..', 'n......', '.......'] },
  { id: 'skull', rows: ['.wwwww.', 'wwwwwww', 'wkwwwkw', 'wwwkwww', '.wwwww.', '..w.w..', '.......'] },
  { id: 'sparkle', rows: ['...p...', '.p.p.p.', '..ppp..', 'pppwppp', '..ppp..', '.p.p.p.', '...p...'] }
]

const SMALL_CAP_FALLBACK: Record<string, string> = { 'ǫ': 'ɋ' }

export const toRankSmallCaps = (text: string) =>
  [...toSmallCaps(text, true)].map(ch => SMALL_CAP_FALLBACK[ch] ?? ch).join('')

export const iconById = (id: string) => RANK_ICONS.find(i => i.id === id)

export interface RankTagState {
  label: string
  style: RankStyle
  icon: string
  customIcon: string
  iconMode: IconMode
  iconGap: number
  compactIconPad: boolean
  textColor: string
  shadow: number
  shadowColor: string
  outlineColor: string
  gradient: boolean
  bgStart: string
  bgEnd: string
  border: number
  borderColor: string
  padX: number
  padY: number
}

export function defaultRankTag(): RankTagState {
  return {
    label: 'OWNER',
    style: 'classic',
    icon: 'crown',
    customIcon: '',
    iconMode: 'joined',
    iconGap: 2,
    compactIconPad: false,
    textColor: '#FFFFFF',
    shadow: 1,
    shadowColor: '',
    outlineColor: '#1E1B4B',
    gradient: true,
    bgStart: '#DC2626',
    bgEnd: '#7F1D1D',
    border: 1,
    borderColor: '#FCA5A5',
    padX: 2,
    padY: 1
  }
}

export interface Rect { x: number, y: number, w: number, h: number }

export interface TagLayout {
  width: number
  height: number
  islands: Rect[]
  icon?: Rect
  text: { x: number, y: number }
}

export interface LayoutInput {
  textWidth: number
  glyphHeight: number
  iconSize: number
  hasIcon: boolean
  iconMode: IconMode
  iconGap: number
  compactIconPad: boolean
  padX: number
  padY: number
  border: number
  shadow: number
}

export function tagLayout(input: LayoutInput): TagLayout {
  const {
    textWidth, glyphHeight, iconSize, hasIcon, iconMode,
    iconGap, compactIconPad, padX, padY, border, shadow
  } = input

  const contentH = Math.max(glyphHeight + shadow, hasIcon ? iconSize : 0)
  const boxH = contentH + 2 * padY
  const height = boxH + 2 * border

  const centred = (size: number) => border + padY + Math.round((contentH - size) / 2)

  const textW = Math.max(1, textWidth + shadow)

  if (!hasIcon) {
    const inner = textW + 2 * padX
    return {
      width: inner + 2 * border,
      height,
      islands: [{ x: border, y: border, w: inner, h: boxH }],
      text: { x: border + padX, y: centred(glyphHeight + shadow) }
    }
  }

  if (iconMode === 'joined') {
    const inner = 2 * padX + iconSize + iconGap + textW
    return {
      width: inner + 2 * border,
      height,
      islands: [{ x: border, y: border, w: inner, h: boxH }],
      icon: { x: border + padX, y: centred(iconSize), w: iconSize, h: iconSize },
      text: { x: border + padX + iconSize + iconGap, y: centred(glyphHeight + shadow) }
    }
  }

  const iconPad = compactIconPad ? 1 : padX
  const iconInner = iconSize + 2 * iconPad
  const iconIsland: Rect = { x: border, y: border, w: iconInner, h: boxH }

  const textIsland: Rect = {
    x: iconIsland.x + iconInner + border + iconGap + border,
    y: border,
    w: textW + 2 * padX,
    h: boxH
  }

  return {
    width: textIsland.x + textIsland.w + border,
    height,
    islands: [iconIsland, textIsland],
    icon: { x: border + iconPad, y: centred(iconSize), w: iconSize, h: iconSize },
    text: { x: textIsland.x + padX, y: centred(glyphHeight + shadow) }
  }
}

export const shadowFallback = (hex: string) => {
  const n = fromHex(hex)
  const { r, g, b } = toRgb(n)
  return toHex(((r >> 2) << 16) | ((g >> 2) << 8) | (b >> 2))
}

export interface RankPreset {
  key: string
  patch: Partial<RankTagState>
}

export const RANK_PRESETS: RankPreset[] = [
  { key: 'owner', patch: { label: 'OWNER', icon: 'crown', bgStart: '#DC2626', bgEnd: '#7F1D1D', borderColor: '#FCA5A5', style: 'bold' } },
  { key: 'admin', patch: { label: 'ADMIN', icon: 'shield', bgStart: '#EF4444', bgEnd: '#991B1B', borderColor: '#FCA5A5' } },
  { key: 'partner', patch: { label: 'PARTNER', icon: 'sparkle', bgStart: '#A855F7', bgEnd: '#6B21A8', borderColor: '#E9D5FF' } },
  { key: 'mvip', patch: { label: 'MVIP', icon: 'gem', bgStart: '#F59E0B', bgEnd: '#B45309', borderColor: '#FDE68A', iconMode: 'separate' } },
  { key: 'mod', patch: { label: 'MOD', icon: 'sword', bgStart: '#22C55E', bgEnd: '#15803D', borderColor: '#BBF7D0' } },
  { key: 'helper', patch: { label: 'HELPER', icon: 'heart', bgStart: '#38BDF8', bgEnd: '#0369A1', borderColor: '#BAE6FD' } },
  { key: 'vip', patch: { label: 'VIP', icon: 'star', bgStart: '#EAB308', bgEnd: '#A16207', borderColor: '#FEF08A' } },
  { key: 'void', patch: { label: 'VOID', icon: 'skull', bgStart: '#6D28D9', bgEnd: '#1E1B4B', borderColor: '#C4B5FD', style: 'outline' } },
  { key: 'player', patch: { label: 'PLAYER', icon: 'leaf', bgStart: '#64748B', bgEnd: '#334155', borderColor: '#CBD5E1', style: 'compact' } }
]

export const applyPreset = (preset: RankPreset): RankTagState =>
  ({ ...defaultRankTag(), ...preset.patch })
