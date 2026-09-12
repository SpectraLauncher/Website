<script setup lang="ts">
interface TimeSeries {
  key: string
  label: string
  /** Validated against the dark chart surface — see the note in SERIES_COLORS. */
  color: string
  values: number[]
}

const props = defineProps<{
  days: string[]
  series: TimeSeries[]
}>()

const { locale } = useI18n()

// The drawing is in its own coordinate space and scaled by the browser, so these
// are not pixels — they are the room the labels need.
const W = 720
const H = 180
const PAD = { top: 12, right: 12, bottom: 24, left: 44 }

const plotW = W - PAD.left - PAD.right
const plotH = H - PAD.top - PAD.bottom

// One axis for every series. Two measures of the same kind — counts of things
// that happened — so they share a scale; a second y-axis would let any pair of
// lines be made to cross wherever the author wanted.
const max = computed(() => Math.max(1, ...props.series.flatMap(s => s.values)))

const ticks = computed(() => {
  const top = max.value
  return [0, Math.round(top / 2), top]
})

const x = (i: number) =>
  PAD.left + (props.days.length < 2 ? plotW / 2 : (i / (props.days.length - 1)) * plotW)

const y = (value: number) => PAD.top + plotH - (value / max.value) * plotH

const linePath = (values: number[]) =>
  values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')

const areaPath = (values: number[]) =>
  values.length
    ? `${linePath(values)} L${x(values.length - 1).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`
    : ''

const short = (day: string) =>
  new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${day}T00:00:00Z`))

const count = (n: number) => new Intl.NumberFormat(locale.value).format(n)

// Hover is the default for a line chart: the numbers behind a shape are the
// point of it, and a chart that only shows its outline makes the reader guess.
const at = ref<number | null>(null)

function track(event: MouseEvent) {
  const box = (event.currentTarget as SVGElement).getBoundingClientRect()
  const ratio = (event.clientX - box.left) / box.width
  const i = Math.round(ratio * (props.days.length - 1))
  at.value = Math.min(props.days.length - 1, Math.max(0, i))
}
</script>

<template>
  <figure class="m-0 flex flex-col gap-3">
    <!-- Two series always carry a legend, and with only two they are direct
         labelled as well, so identity never rests on colour alone. -->
    <figcaption class="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span
        v-for="s in series"
        :key="s.key"
        class="inline-flex items-center gap-1.5 text-xs text-muted"
      >
        <span class="size-2.5 rounded-full" :style="{ background: s.color }"></span>
        {{ s.label }}
        <b class="font-mono font-semibold tabular-nums text-default">
          {{ count(at === null ? s.values.reduce((a, b) => a + b, 0) : (s.values[at] ?? 0)) }}
        </b>
      </span>

      <span v-if="at !== null" class="ml-auto font-mono text-xs text-dimmed">
        {{ short(days[at] ?? '') }}
      </span>
    </figcaption>

    <div class="overflow-x-auto">
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        class="h-44 w-full min-w-[22rem]"
        role="img"
        @mousemove="track"
        @mouseleave="at = null"
      >
        <!-- Recessive: the grid is there to be measured against, not read. -->
        <g>
          <line
            v-for="tick in ticks"
            :key="tick"
            :x1="PAD.left"
            :x2="W - PAD.right"
            :y1="y(tick)"
            :y2="y(tick)"
            stroke="#1c2229"
            stroke-width="1"
          />
          <text
            v-for="tick in ticks"
            :key="`l${tick}`"
            :x="PAD.left - 8"
            :y="y(tick) + 4"
            text-anchor="end"
            fill="#6c7688"
            font-size="11"
            font-family="ui-monospace, monospace"
          >{{ count(tick) }}</text>
        </g>

        <g v-for="s in series" :key="s.key">
          <path :d="areaPath(s.values)" :fill="s.color" fill-opacity="0.12" stroke="none" />
          <path
            :d="linePath(s.values)"
            fill="none"
            :stroke="s.color"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        </g>

        <g v-if="at !== null">
          <line
            :x1="x(at)"
            :x2="x(at)"
            :y1="PAD.top"
            :y2="PAD.top + plotH"
            stroke="#39424f"
            stroke-width="1"
          />
          <!-- A 2px ring in the surface colour keeps the marker readable where
               the two series cross. -->
          <circle
            v-for="s in series"
            :key="s.key"
            :cx="x(at)"
            :cy="y(s.values[at] ?? 0)"
            r="4"
            :fill="s.color"
            stroke="#0e1216"
            stroke-width="2"
          />
        </g>

        <text
          :x="PAD.left"
          :y="H - 6"
          fill="#6c7688"
          font-size="11"
          font-family="ui-monospace, monospace"
        >{{ short(days[0] ?? '') }}</text>
        <text
          :x="W - PAD.right"
          :y="H - 6"
          text-anchor="end"
          fill="#6c7688"
          font-size="11"
          font-family="ui-monospace, monospace"
        >{{ short(days.at(-1) ?? '') }}</text>
      </svg>
    </div>
  </figure>
</template>
