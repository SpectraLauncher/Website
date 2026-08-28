export type TellrawVersion = 'modern' | 'legacy'
export type TellrawPlacement = 'chat' | 'title' | 'subtitle' | 'actionbar'
export type ClickAction = 'none' | 'run_command' | 'suggest_command' | 'open_url' | 'copy_to_clipboard'

export interface TellrawSegment {
  text: string
  color: string
  bold: boolean
  italic: boolean
  underlined: boolean
  strikethrough: boolean
  obfuscated: boolean
  clickAction: ClickAction
  clickValue: string
  hoverText: string
}

export const CLICK_ACTIONS: ClickAction[] = [
  'none', 'run_command', 'suggest_command', 'open_url', 'copy_to_clipboard'
]

export const emptySegment = (text = ''): TellrawSegment => ({
  text,
  color: 'white',
  bold: false,
  italic: false,
  underlined: false,
  strikethrough: false,
  obfuscated: false,
  clickAction: 'none',
  clickValue: '',
  hoverText: ''
})

const STYLE_KEYS = ['bold', 'italic', 'underlined', 'strikethrough', 'obfuscated'] as const

function clickPayload(seg: TellrawSegment, version: TellrawVersion) {
  if (seg.clickAction === 'none' || !seg.clickValue) return undefined

  if (version === 'legacy') {
    return { key: 'clickEvent', body: { action: seg.clickAction, value: seg.clickValue } }
  }

  const field = seg.clickAction === 'open_url'
    ? 'url'
    : seg.clickAction === 'copy_to_clipboard'
      ? 'value'
      : 'command'

  return { key: 'click_event', body: { action: seg.clickAction, [field]: seg.clickValue } }
}

function hoverPayload(seg: TellrawSegment, version: TellrawVersion) {
  if (!seg.hoverText) return undefined

  return version === 'legacy'
    ? { key: 'hoverEvent', body: { action: 'show_text', contents: seg.hoverText } }
    : { key: 'hover_event', body: { action: 'show_text', value: seg.hoverText } }
}

export function segmentToJson(seg: TellrawSegment, version: TellrawVersion): Record<string, unknown> {
  const out: Record<string, unknown> = { text: seg.text }

  if (seg.color && seg.color !== 'white') out.color = seg.color
  for (const key of STYLE_KEYS) if (seg[key]) out[key] = true

  const click = clickPayload(seg, version)
  if (click) out[click.key] = click.body

  const hover = hoverPayload(seg, version)
  if (hover) out[hover.key] = hover.body

  return out
}

export const segmentsToJson = (segments: TellrawSegment[], version: TellrawVersion) => {
  const parts = segments.filter(s => s.text).map(s => segmentToJson(s, version))
  return parts.length ? JSON.stringify(['', ...parts]) : '[]'
}

export interface TitleTimes {
  fadeIn: number
  stay: number
  fadeOut: number
}

export const DEFAULT_TIMES: TitleTimes = {
  fadeIn: 10,
  stay: 70,
  fadeOut: 20,
}

export function tellrawCommand(segments: TellrawSegment[], placement: TellrawPlacement, version: TellrawVersion, target = '@a', times: TitleTimes = DEFAULT_TIMES): string {
  const json = segmentsToJson(segments, version)
  if (json === '[]') return ''

  if (placement === 'chat') return `/tellraw ${target} ${json}`

  const lines: string[] = []
  const custom = times.fadeIn !== DEFAULT_TIMES.fadeIn
    || times.stay !== DEFAULT_TIMES.stay
    || times.fadeOut !== DEFAULT_TIMES.fadeOut

  if (placement !== 'actionbar' && custom) {
    lines.push(`/title ${target} times ${times.fadeIn} ${times.stay} ${times.fadeOut}`)
  }

  lines.push(`/title ${target} ${placement} ${json}`)
  return lines.join('\n')
}

export const TELLRAW_TARGETS = ['@a', '@p', '@s', '@r', '@e']
