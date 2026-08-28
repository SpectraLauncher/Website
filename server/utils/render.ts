import { poseById, type RenderCrop } from '~/utils/skinPose'
import { renderSkin } from '~/utils/skinRender'
import type { EffectId, LightId } from '~/utils/skinStyle'

const cachedSkinTexture = defineCachedFunction(
  async (url: string) => {
    const raw = await $fetch<ArrayBuffer>(url, { responseType: 'arrayBuffer', timeout: 8000 })
    return Buffer.from(raw).toString('base64')
  },
  {
    name: 'skin-texture',
    maxAge: 60 * 60 * 6,
    getKey: (url: string) => `texture:${url.split('/').pop()}`
  }
)

export const cachedRender = defineCachedFunction(
  async (
    type: string, player: string, crop: string, size: number,
    light: LightId, effect: EffectId, extras: string
  ) => {
    const { cape: wantCape, voxel, nametag, autoTag, yaw, pitch, rim } = JSON.parse(extras) as {
      cape: boolean, voxel: boolean, nametag: string, autoTag: boolean
      yaw: number | null, pitch: number | null, rim: number | null
    }

    const pose = poseById(type)
    if (!pose) return ''

    const profile = await resolveProfile(player)
    if (!profile?.skin) return ''

    const raw = await cachedSkinTexture(profile.skin).catch(() => '')
    if (!raw) return ''

    const decoded = decodePng(Buffer.from(raw, 'base64'))
    if (!decoded) return ''

    let cape = null
    if (wantCape && profile.cape) {
      const bytes = await cachedSkinTexture(profile.cape).catch(() => '')
      cape = bytes ? decodePng(Buffer.from(bytes, 'base64')) : null
    }

    const result = renderSkin({
      skin: normaliseTexture(decoded),
      pose,
      crop: crop as RenderCrop,
      model: profile.model,
      size,
      light,
      effect,
      cape,
      voxel,
      nametag: autoTag ? profile.name : nametag || undefined,
      yaw: yaw ?? undefined,
      pitch: pitch ?? undefined,
      rim: rim ?? undefined
    })

    return encodePng(result.data, result.width, result.height).toString('base64')
  },
  {
    name: 'skin-render',
    maxAge: 60 * 60 * 6,
    getKey: (
      type: string, player: string, crop: string, size: number,
      light: LightId, effect: EffectId, extras: string
    ) => `${type}:${player.toLowerCase()}:${crop}:${size}:${light}:${effect}:${extras}`
  }
)
