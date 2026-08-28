export type ToolCat = 'fmt' | 'design' | 'cmd' | 'calc' | 'srv' | 'skin'

export interface Tool {
  id: string
  name: string
  icon: string
  cat: ToolCat
  live?: boolean
  bg?: string
  glow?: number
  page?: boolean
  featured?: boolean
}

export const TOOLS: Tool[] = [
  { id: 'color-codes', name: 'Color Codes', icon: 'i-lucide-palette', cat: 'fmt', live: true, featured: true, bg: '/tools/colors.svg', glow: 210, page: true },
  { id: 'motd', name: 'MOTD Generator', icon: 'i-lucide-server', cat: 'srv', live: true, featured: true, bg: '/tools/motd.svg', glow: 142, page: true },
  { id: 'gradient', name: 'Gradient Generator', icon: 'i-lucide-blend', cat: 'design', live: true, featured: true, bg: '/tools/gradient.svg', glow: 265, page: true },
  { id: 'banner', name: 'Banner Designer', icon: 'i-lucide-flag', cat: 'design', live: true, featured: true, bg: '/tools/banner.svg', glow: 0, page: true },
  { id: 'coords', name: 'Coordinate Calculator', icon: 'i-lucide-compass', cat: 'calc', live: true, featured: true, bg: '/tools/coords.svg', glow: 275, page: true },
  { id: 'xp', name: 'XP Calculator', icon: 'i-lucide-sparkles', cat: 'calc', live: true, bg: '/tools/xp.svg', glow: 100, page: true },
  { id: 'armor-dye', name: 'Armor Dye', icon: 'i-lucide-shirt', live: true, cat: 'design', bg: '/tools/armor-dye.svg', glow: 25, page: true },
  { id: 'tellraw', name: 'Tellraw & Title', icon: 'i-lucide-message-square-code', cat: 'cmd', live: true, bg: '/tools/tellraw.svg', glow: 205, page: true },
  { id: 'skin-editor', name: 'Skin Editor', icon: 'i-lucide-brush', cat: 'skin', live: true, bg: '/tools/skin-editor.svg', glow: 265, page: true },
  { id: 'display', name: 'Display Generator', icon: 'i-lucide-box', cat: 'cmd', live: true, bg: '/tools/display.svg', glow: 150, page: true },
  { id: 'circle', name: 'Circle Generator', icon: 'i-lucide-circle-dashed', cat: 'calc', live: true, bg: '/tools/circle.svg', glow: 190, page: true },
  { id: 'tick', name: 'Tick Converter', icon: 'i-lucide-timer', cat: 'calc', live: true, bg: '/tools/tick.svg', glow: 45, page: true },
  { id: 'locator', name: 'Locator Bar Color', icon: 'i-lucide-locate-fixed', cat: 'fmt', live: true, bg: '/tools/locator.svg', glow: 300, page: true },
  { id: 'potion', name: 'Potion Guide', icon: 'i-lucide-flask-conical', cat: 'calc', live: true, bg: '/tools/potion.svg', glow: 295, page: true },
  { id: 'skin-stealer', name: 'Skin Stealer', icon: 'i-lucide-download', cat: 'skin', live: true, bg: '/tools/skin-stealer.svg', glow: 245, page: true },
  { id: 'player-head', name: 'Player Heads', icon: 'i-lucide-user-square', cat: 'skin', live: true, bg: '/tools/player-head.svg', glow: 190, page: true },
  { id: 'small-text', name: 'Small Text Converter', icon: 'i-lucide-type', cat: 'fmt', live: true, bg: '/tools/small-text.svg', glow: 210, page: true },
  { id: 'unicode', name: 'Unicode Symbols', icon: 'i-lucide-hash', cat: 'fmt', live: true, bg: '/tools/unicode.svg', glow: 210, page: true },
  { id: 'text-animation', name: 'Text Animations', icon: 'i-lucide-wand-sparkles', cat: 'fmt', live: true, featured: true, bg: '/tools/text-animation.svg', glow: 280, page: true },
  { id: 'skin-poses', name: 'Skin Poses', icon: 'i-lucide-person-standing', cat: 'skin', live: true, bg: '/tools/skin-poses.svg', glow: 245, page: true },
  { id: 'start-file', name: 'Start File Generator', icon: 'i-lucide-terminal', cat: 'srv', live: true, bg: '/tools/start-file.svg', glow: 40, page: true },
  { id: 'rank', name: 'Rank Generator', icon: 'i-lucide-badge-check', cat: 'srv', live: true, bg: '/tools/rank.svg', glow: 330, page: true }
]

export const FEATURED_TOOLS = TOOLS.filter(t => t.featured)
