export type FlagPreset = 'none' | 'aikar' | 'aikar_extreme' | 'zgc' | 'proxy'
export type JavaLine = 21 | 23
export type ServerOs = 'windows' | 'unix'

export interface StartFileOptions {
  jar: string
  ramGb: number
  preset: FlagPreset
  os: ServerOs
  gui: boolean
  restart: boolean
  vector?: boolean
  java?: JavaLine
}

export const VECTOR_FLAG = '--add-modules=jdk.incubator.vector'

const AIKAR_COMMON = [
  '-XX:+UseG1GC',
  '-XX:+ParallelRefProcEnabled',
  '-XX:MaxGCPauseMillis=200',
  '-XX:+UnlockExperimentalVMOptions',
  '-XX:+DisableExplicitGC',
  '-XX:+AlwaysPreTouch',
  '-XX:G1HeapWastePercent=5',
  '-XX:G1MixedGCCountTarget=4',
  '-XX:G1MixedGCLiveThresholdPercent=90',
  '-XX:G1RSetUpdatingPauseTimePercent=5',
  '-XX:SurvivorRatio=32',
  '-XX:+PerfDisableSharedMem',
  '-XX:MaxTenuringThreshold=1',
  '-Dusing.aikars.flags=https://mcflags.emc.gs',
  '-Daikars.new.flags=true'
]

const AIKAR_SMALL = [
  '-XX:G1NewSizePercent=30',
  '-XX:G1MaxNewSizePercent=40',
  '-XX:G1HeapRegionSize=8M',
  '-XX:G1ReservePercent=20',
  '-XX:InitiatingHeapOccupancyPercent=15'
]

const AIKAR_LARGE = [
  '-XX:G1NewSizePercent=40',
  '-XX:G1MaxNewSizePercent=50',
  '-XX:G1HeapRegionSize=16M',
  '-XX:G1ReservePercent=15',
  '-XX:InitiatingHeapOccupancyPercent=20'
]

export const ZGENERATIONAL_FLAG = '-XX:+ZGenerational'

const ZGC_FLAGS = [
  '-XX:+UseZGC',
  '-XX:+AlwaysPreTouch',
  '-XX:+ParallelRefProcEnabled',
  '-XX:+DisableExplicitGC',
  '-XX:+PerfDisableSharedMem'
]

export const ZGC_MIN_GB = 16

const PROXY_FLAGS = [
  '-XX:+UseG1GC',
  '-XX:G1HeapRegionSize=4M',
  '-XX:+UnlockExperimentalVMOptions',
  '-XX:+ParallelRefProcEnabled',
  '-XX:+AlwaysPreTouch',
  '-XX:MaxInlineLevel=15'
]

export const AIKAR_EXTREME_MIN_GB = 12

export function flagsFor(preset: FlagPreset, vector = true, java: JavaLine = 21): string[] {
  const head = vector ? [VECTOR_FLAG] : []

  switch (preset) {
    case 'aikar': return [...head, ...AIKAR_COMMON, ...AIKAR_SMALL]
    case 'aikar_extreme': return [...head, ...AIKAR_COMMON, ...AIKAR_LARGE]
    case 'zgc': return [
      ...head,
      '-XX:+UseZGC',
      ...(java === 21 ? [ZGENERATIONAL_FLAG] : []),
      ...ZGC_FLAGS.slice(1)
    ]
    case 'proxy': return PROXY_FLAGS
    case 'none': return []
  }
}

const memFlags = (ramGb: number) => {
  const mb = Math.max(512, Math.round(ramGb * 1024))
  return [`-Xms${mb}M`, `-Xmx${mb}M`]
}

export function javaCommand(opts: StartFileOptions): string {
  const jar = opts.jar.trim() || 'server.jar'
  return [
    'java',
    ...memFlags(opts.ramGb),
    ...flagsFor(opts.preset, opts.vector ?? true, opts.java ?? 21),
    '-jar',
    jar,
    ...(opts.gui ? [] : ['--nogui'])
  ].join(' ')
}

export const scriptName = (os: ServerOs) => (os === 'windows' ? 'start.bat' : 'start.sh')

export function buildScript(opts: StartFileOptions): string {
  const cmd = javaCommand(opts)

  if (opts.os === 'windows') {
    if (!opts.restart) return `@echo off\n${cmd}\npause`

    return [
      '@echo off',
      ':start',
      cmd,
      'echo.',
      'echo Server stopped. Restarting in 5 seconds — press Ctrl+C to cancel.',
      'timeout /t 5',
      'goto start'
    ].join('\n')
  }

  if (!opts.restart) return `#!/bin/bash\n${cmd}`

  return [
    '#!/bin/bash',
    'while true; do',
    `  ${cmd}`,
    '  echo "Server stopped. Restarting in 5 seconds — press Ctrl+C to cancel."',
    '  sleep 5',
    'done'
  ].join('\n')
}

export interface RamEstimate {
  gb: number
  players: number
  mods: number
}

export const MAX_PLAYERS = 100
export const MAX_MODS = 50

export function estimateRam(players: number, mods: number): number {
  const p = Math.max(0, Math.min(MAX_PLAYERS, players))
  const m = Math.max(0, Math.min(MAX_MODS, mods))

  const raw = 2 + p * 0.12 + m * 0.16
  const rounded = Math.ceil(raw * 2) / 2
  return Math.max(1, Math.min(64, rounded))
}

export const FLAG_PRESETS: FlagPreset[] = ['none', 'aikar', 'aikar_extreme', 'zgc', 'proxy']
