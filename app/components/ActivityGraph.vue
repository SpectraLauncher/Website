<script setup lang="ts">

const props = withDefaults(defineProps<{
  days: Array<{ day: string, launches: number, seconds: number }>
  weeks?: number
}>(), { weeks: 53 })

const { t, locale } = useI18n()

const DAY_MS = 86_400_000
const key = (d: Date) => d.toISOString().slice(0, 10)

interface Cell {
  day: string
  launches: number
  seconds: number
  future: boolean
}

const grid = computed<Cell[][]>(() => {
  const found = new Map(props.days.map(d => [d.day, d]))

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const toSunday = (7 - today.getUTCDay()) % 7
  const end = new Date(today.getTime() + toSunday * DAY_MS)
  const start = new Date(end.getTime() - (props.weeks * 7 - 1) * DAY_MS)

  const weeks: Cell[][] = []

  for (let w = 0; w < props.weeks; w++) {
    const column: Cell[] = []

    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * DAY_MS)
      const id = key(date)
      const hit = found.get(id)

      column.push({
        day: id,
        launches: hit?.launches ?? 0,
        seconds: hit?.seconds ?? 0,
        future: date.getTime() > today.getTime()
      })
    }

    weeks.push(column)
  }

  return weeks
})

const peak = computed(() => Math.max(1, ...props.days.map(d => d.seconds)))

function level(cell: Cell) {
  if (cell.future) return -1
  if (!cell.seconds && !cell.launches) return 0

  const share = cell.seconds / peak.value
  if (share > 0.66) return 4
  if (share > 0.33) return 3
  if (share > 0.1) return 2
  return 1
}

const SHADE = [
  'bg-white/[0.04]',
  'bg-primary/25',
  'bg-primary/45',
  'bg-primary/70',
  'bg-primary'
]

const WEEKDAYS = [0, 2, 4]

const dayName = (index: number) => {
  const date = new Date(Date.UTC(2024, 0, 1 + index))
  return new Intl.DateTimeFormat(locale.value, { weekday: 'short', timeZone: 'UTC' }).format(date)
}

const monthLabels = computed(() => {
  const out: Array<{ index: number, label: string }> = []
  let previous = ''

  grid.value.forEach((week, index) => {
    const first = week[0]
    if (!first) return

    const month = new Intl.DateTimeFormat(locale.value, { month: 'short', timeZone: 'UTC' })
      .format(new Date(`${first.day}T00:00:00Z`))

    const room = !out.length || index - out[out.length - 1]!.index >= 3

    if (month !== previous && room) {
      out.push({ index, label: month })
      previous = month
    }
  })

  return out
})

const tooltip = (cell: Cell) => {
  const date = new Intl.DateTimeFormat(locale.value, { dateStyle: 'long', timeZone: 'UTC' })
    .format(new Date(`${cell.day}T00:00:00Z`))

  if (!cell.seconds && !cell.launches) return `${date}: ${t('activity.nothing')}`

  const parts = [humanDuration(cell.seconds)]
  if (cell.launches) parts.push(t('activity.launches', { n: cell.launches }))
  return `${date}: ${parts.join(' · ')}`
}
</script>

<template>
  <div class="overflow-x-auto">
    <div class="min-w-full">
      <div class="mb-1 flex gap-[3px] ps-8 text-[10px] text-dimmed">
        <div
          v-for="(week, index) in grid"
          :key="index"
          class="min-w-2 flex-1"
        >
          <span v-if="monthLabels.find(m => m.index === index)" class="whitespace-nowrap">
            {{ monthLabels.find(m => m.index === index)!.label }}
          </span>
        </div>
      </div>

      <div class="flex gap-[3px]">
        <div class="flex w-8 shrink-0 flex-col gap-[3px] pe-1 text-[10px] text-dimmed">
          <span v-for="d in 7" :key="d" class="flex flex-1 items-center justify-end leading-none">
            {{ WEEKDAYS.includes(d - 1) ? dayName(d - 1) : '' }}
          </span>
        </div>

        <div
          v-for="(week, index) in grid"
          :key="index"
          class="flex min-w-2 flex-1 flex-col gap-[3px]"
        >
          <span
            v-for="cell in week"
            :key="cell.day"
            class="aspect-square w-full rounded-[3px]"
            :class="level(cell) < 0 ? 'bg-transparent' : SHADE[level(cell)]"
            :title="level(cell) < 0 ? '' : tooltip(cell)"
          ></span>
        </div>
      </div>

      <div class="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-dimmed">
        {{ t('activity.less') }}
        <span v-for="shade in SHADE" :key="shade" class="size-3 rounded-[3px]" :class="shade"></span>
        {{ t('activity.more') }}
      </div>
    </div>
  </div>
</template>
