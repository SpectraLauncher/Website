import { POSES, CROPS, isRenderCrop, poseById } from '~/utils/skinPose'
import { EFFECT_IDS, LIGHT_IDS, isEffectId, isLightId } from '~/utils/skinStyle'

const MIN_SIZE = 32
const MAX_SIZE = 1024
const DEFAULT_SIZE = 512

export default defineEventHandler(async (event) => {
  const type = String(getRouterParam(event, 'type') ?? '').toLowerCase()
  const rawPlayer = String(getRouterParam(event, 'player') ?? '')
  const rawCrop = String(getRouterParam(event, 'crop') ?? '').toLowerCase()

  const player = rawPlayer.replace(/\.png$/i, '')
  const crop = rawCrop.replace(/\.png$/i, '')

  const pose = poseById(type)
  if (!pose) {
    throw createError({
      statusCode: 404,
      statusMessage: `unknown render type, expected one of: ${POSES.map(p => p.id).join(', ')}`
    })
  }

  if (!isRenderCrop(crop)) {
    throw createError({
      statusCode: 404,
      statusMessage: `unknown crop, expected one of: ${Object.keys(CROPS).join(', ')}`
    })
  }

  if (!/^[A-Za-z0-9_]{1,16}$/.test(player) && !/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(player)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid player' })
  }

  const query = getQuery(event)
  const requested = Number(query.size ?? DEFAULT_SIZE)
  const size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(requested) || DEFAULT_SIZE))

  const light = String(query.light ?? 'flat').toLowerCase()
  if (!isLightId(light)) {
    throw createError({ statusCode: 400, statusMessage: `unknown light, expected one of: ${LIGHT_IDS.join(', ')}` })
  }

  const effect = String(query.fx ?? 'none').toLowerCase()
  if (!isEffectId(effect)) {
    throw createError({ statusCode: 400, statusMessage: `unknown fx, expected one of: ${EFFECT_IDS.join(', ')}` })
  }

  const flag = (v: unknown) => v === '' || v === '1' || v === 'true'

  const rawTag = String(query.nametag ?? '')
  const autoTag = rawTag === '1' || rawTag === 'true'
  const nametag = autoTag ? '' : rawTag.replace(/[^ -~]/g, '').slice(0, 24)

  const angle = (raw: unknown, limit: number) => {
    if (raw === undefined || raw === '') return null
    const value = Number(raw)
    return Number.isFinite(value) ? Math.max(-limit, Math.min(limit, value)) : null
  }

  const extras = JSON.stringify({
    cape: flag(query.cape),
    voxel: flag(query.voxel),
    nametag,
    autoTag,
    yaw: angle(query.yaw, 360),
    pitch: angle(query.pitch, 89),
    rim: query.rim === undefined ? null : Math.max(0, Math.min(200, Number(query.rim) || 0)) / 100
  })

  const png = await cachedRender(type, player.toLowerCase(), crop, size, light, effect, extras)
  if (!png) throw createError({ statusCode: 404, statusMessage: 'player or skin not found' })

  setHeader(event, 'content-type', 'image/png')
  setHeader(event, 'cache-control', 'public, max-age=21600')
  setHeader(event, 'access-control-allow-origin', '*')
  return Buffer.from(png, 'base64')
})
