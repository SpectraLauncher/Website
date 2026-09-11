export type HeadVersion = 'modern' | 'legacy'
export type HeadMode = 'name' | 'texture'

export const HEAD_VERSIONS: HeadVersion[] = ['modern', 'legacy']
export const HEAD_MODES: HeadMode[] = ['name', 'texture']

export const MAX_STACK = 64

export interface HeadOptions {
  version: HeadVersion
  mode: HeadMode
  name: string
  uuid: string
  textures: string
  target: string
  amount: number
}

export const clampAmount = (value: number) =>
  Math.min(MAX_STACK, Math.max(1, Math.floor(Number(value) || 1)))

export function uuidToIntArray(uuid: string): number[] {
  const hex = uuid.replace(/-/g, '').padEnd(32, '0').slice(0, 32)
  return [0, 1, 2, 3].map(i => parseInt(hex.slice(i * 8, i * 8 + 8), 16) | 0)
}

export const texturesJson = (skinUrl: string) =>
  JSON.stringify({ textures: { SKIN: { url: skinUrl } } })

const quoted = (value: string) => JSON.stringify(value)

export function headCommand(opts: HeadOptions): string {
  const target = opts.target.trim() || '@p'
  const amount = clampAmount(opts.amount)
  const count = amount > 1 ? ` ${amount}` : ''

  if (opts.mode === 'name') {
    const payload = opts.version === 'modern'
      ? `[profile=${quoted(opts.name)}]`
      : `{SkullOwner:${quoted(opts.name)}}`
    return `/give ${target} minecraft:player_head${payload}${count}`
  }

  const property = `{name:"textures",value:${quoted(opts.textures)}}`

  if (opts.version === 'modern') {
    return `/give ${target} minecraft:player_head[profile={properties:[${property}]}]${count}`
  }

  const id = uuidToIntArray(opts.uuid).join(',')
  const owner = `{Id:[I;${id}],Properties:{textures:[{Value:${quoted(opts.textures)}}]}}`
  return `/give ${target} minecraft:player_head{SkullOwner:${owner}}${count}`
}

export const HEAD_TARGETS = ['@p', '@s', '@a', '@r']

export const headFileName = (name: string) =>
  `${name.replace(/[^A-Za-z0-9_-]/g, '') || 'player'}-head.png`
