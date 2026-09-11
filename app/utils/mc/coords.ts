export interface Vec3 { x: number, y: number, z: number }

export const NETHER_RATIO = 8

export const toNether = (v: Vec3): Vec3 => ({
  x: Math.floor(v.x / NETHER_RATIO),
  y: v.y,
  z: Math.floor(v.z / NETHER_RATIO)
})

export const toOverworld = (v: Vec3): Vec3 => ({
  x: v.x * NETHER_RATIO,
  y: v.y,
  z: v.z * NETHER_RATIO
})

export interface Distances {
  dx: number
  dy: number
  dz: number
  d3: number
  d2: number
}

export function distances(a: Vec3, b: Vec3): Distances {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = b.z - a.z
  return {
    dx,
    dy,
    dz,
    d3: Math.sqrt(dx * dx + dy * dy + dz * dz),
    d2: Math.sqrt(dx * dx + dz * dz)
  }
}

export interface ChunkInfo {
  chunkX: number
  chunkZ: number
  inChunkX: number
  inChunkZ: number
  regionX: number
  regionZ: number
  regionFile: string
  chunkMinX: number
  chunkMinZ: number
  chunkInRegion: number
}

export function chunkInfo(v: Vec3): ChunkInfo {
  const chunkX = Math.floor(v.x / 16)
  const chunkZ = Math.floor(v.z / 16)
  const regionX = Math.floor(chunkX / 32)
  const regionZ = Math.floor(chunkZ / 32)

  return {
    chunkX,
    chunkZ,
    inChunkX: ((v.x % 16) + 16) % 16,
    inChunkZ: ((v.z % 16) + 16) % 16,
    regionX,
    regionZ,
    regionFile: `r.${regionX}.${regionZ}.mca`,
    chunkMinX: chunkX * 16,
    chunkMinZ: chunkZ * 16,
    chunkInRegion: (((chunkZ % 32) + 32) % 32) * 32 + (((chunkX % 32) + 32) % 32)
  }
}

export const tpCommand = (v: Vec3, target = '@s') =>
  `/tp ${target} ${v.x} ${v.y} ${v.z}`

export const PORTAL_SEARCH_OVERWORLD = 128
export const PORTAL_SEARCH_NETHER = 16
