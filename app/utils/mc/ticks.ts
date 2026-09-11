export const TICKS_PER_SECOND = 20
export const TICKS_PER_DAY = 24_000
export const REAL_SECONDS_PER_DAY = TICKS_PER_DAY / TICKS_PER_SECOND

export const DAWN_OFFSET_TICKS = 6_000

export interface Duration {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export const ticksToSeconds = (ticks: number) => ticks / TICKS_PER_SECOND

export function ticksToDuration(ticks: number): Duration {
  const total = Math.max(0, Math.floor(ticks)) / TICKS_PER_SECOND
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor(total / 3_600) % 24,
    minutes: Math.floor(total / 60) % 60,
    seconds: Math.floor(total) % 60
  }
}

export const durationToTicks = (d: Partial<Duration>) =>
  Math.round(
    ((d.days ?? 0) * 86_400 + (d.hours ?? 0) * 3_600 + (d.minutes ?? 0) * 60 + (d.seconds ?? 0))
    * TICKS_PER_SECOND
  )

export const mcDays = (ticks: number) => ticks / TICKS_PER_DAY

export const dayTick = (ticks: number) =>
  ((Math.floor(ticks) % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY

export interface ClockTime {
  hours: number
  minutes: number
  label: string
}

export function tickToClock(ticks: number): ClockTime {
  const t = dayTick(ticks)
  const minutesOfDay = ((t + DAWN_OFFSET_TICKS) % TICKS_PER_DAY) / TICKS_PER_DAY * 1440
  const hours = Math.floor(minutesOfDay / 60)
  const minutes = Math.floor(minutesOfDay % 60)
  return {
    hours,
    minutes,
    label: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }
}

export function clockToTick(hours: number, minutes: number): number {
  const minutesOfDay = ((hours % 24) * 60 + minutes) % 1440
  const raw = minutesOfDay / 1440 * TICKS_PER_DAY - DAWN_OFFSET_TICKS
  return dayTick(Math.round(raw))
}

export interface DayPhase {
  key: string
  from: number
  to: number
}

export const DAY_PHASES: DayPhase[] = [
  { key: 'day', from: 0, to: 11_999 },
  { key: 'sunset', from: 12_000, to: 12_999 },
  { key: 'night', from: 13_000, to: 22_999 },
  { key: 'sunrise', from: 23_000, to: 23_999 }
]

export const SLEEP_FROM = 12_542
export const SLEEP_TO = 23_459
export const MOBS_FROM = 13_000
export const MOBS_TO = 22_999

export const phaseAt = (ticks: number) => {
  const t = dayTick(ticks)
  return DAY_PHASES.find(p => t >= p.from && t <= p.to) ?? DAY_PHASES[0]!
}

export const canSleep = (ticks: number) => {
  const t = dayTick(ticks)
  return t >= SLEEP_FROM && t <= SLEEP_TO
}

export const mobsSpawn = (ticks: number) => {
  const t = dayTick(ticks)
  return t >= MOBS_FROM && t <= MOBS_TO
}

export interface TimePreset {
  key: string
  ticks: number
  command?: string
}

export const TIME_PRESETS: TimePreset[] = [
  { key: 'day', ticks: 1_000, command: 'day' },
  { key: 'noon', ticks: 6_000, command: 'noon' },
  { key: 'sunset', ticks: 12_000 },
  { key: 'night', ticks: 13_000, command: 'night' },
  { key: 'midnight', ticks: 18_000, command: 'midnight' },
  { key: 'sunrise', ticks: 23_000 }
]

export const timeSetCommand = (ticks: number, target?: string) =>
  `/time set ${target ?? dayTick(ticks)}`

export const perDay = (periodTicks: number) =>
  periodTicks > 0 ? TICKS_PER_DAY / periodTicks : 0
