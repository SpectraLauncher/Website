
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig()

  const owner = await requireUser(event)
  rateLimit(event, { key: `share-upload:${owner.id}`, limit: 10, windowMs: 60_000 })

  const r2 = useR2()
  if (!r2) throw createError({ statusCode: 501, statusMessage: 'pack storage is not configured' })

  const body = await readBody<{
    size?: number
    name?: string
    mc?: string
    loader?: string
    mods?: number
    instance?: string
    code?: string
    base?: number
  }>(event) ?? {}

  const size = Number(body.size)
  if (!Number.isFinite(size) || size <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'missing pack size' })
  }
  if (size > MAX_PACK_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: `pack too large (${Math.round(size / 1048576)} MB, max ${MAX_PACK_BYTES / 1073741824} GB)`,
    })
  }

  await pruneShares()

  const now = Date.now()
  const instanceId = clampStr(body.instance, 64) ?? null
  const meta = {
    name: clampStr(body.name, 80) ?? 'Minecraft instance',
    mc_version: clampStr(body.mc, 24) ?? null,
    loader: clampStr(body.loader, 24) ?? null,
    mods: Number(body.mods) || 0,
  }

  const base = Number.isInteger(body.base) ? Number(body.base) : null

  // A collaborator names the code, since their instance id means nothing to
  // the owner's row. The owner may name it too, or let the instance find it.
  let existing: {
    code: string
    owner_id: string | null
    revision: number
    uploaded: boolean
    pending_by: string | null
    pending_at: string | null
    can_push: boolean | null
  } | undefined
  if (body.code) {
    existing = await one(
      `SELECT s.code, s.owner_id, s.revision, s.uploaded, s.pending_by, s.pending_at, r.can_push
       FROM shares s LEFT JOIN share_recipient r ON r.code = s.code AND r.user_id = $2
       WHERE s.code = $1 AND s.expires > $3`,
      [normalizeCode(body.code), owner.id, now],
    )
    if (!existing || !shareRole(existing.owner_id, owner.id, existing.can_push)) {
      throw createError({ statusCode: 404, statusMessage: 'no such share' })
    }
  } else if (instanceId) {
    existing = await one(
      `SELECT code, owner_id, revision, uploaded, pending_by, pending_at, NULL AS can_push
       FROM shares WHERE owner_id = $1 AND instance_id = $2`,
      [owner.id, instanceId],
    )
  }

  let code: string
  let revision: number

  if (existing) {
    const role = shareRole(existing.owner_id, owner.id, existing.can_push)!
    const refusal = pushRefusal(existing, { role, userId: owner.id, base, now })
    if (refusal) throw createError(refusal)

    code = existing.code
    revision = existing.uploaded ? existing.revision + 1 : existing.revision
    // The name stays the owner's: a collaborator's copy may be called anything.
    // The pending_by condition repeats the busy check inside the UPDATE, so two
    // tickets asked for at the same instant cannot both claim the upload.
    const claimed = await one(
      `UPDATE shares SET name = CASE WHEN $8::boolean THEN $1 ELSE name END, mc_version = $2,
              loader = $3, mods = $4, pending_key = $5, pending_at = $6, pending_by = $9
       WHERE code = $7 AND (pending_by IS NULL OR pending_by = $9 OR pending_at < $10)
       RETURNING code`,
      [meta.name, meta.mc_version, meta.loader, meta.mods, packKey(code, revision), now, code,
        role === 'owner', owner.id, now - UPLOAD_URL_TTL * 1000],
    )
    if (!claimed) throw createError(PUSH_BUSY)
  } else {
    code = await newCode()
    revision = 1
    await exec(
      `INSERT INTO shares (code, created, expires, name, mc_version, loader, mods, size,
                           owner_id, instance_id, revision, uploaded, pending_key, pending_at, pending_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, 1, FALSE, $10, $2, $8)`,
      [code, now, expiryFor(now), meta.name, meta.mc_version, meta.loader, meta.mods,
        owner.id, instanceId, packKey(code, revision)],
    )
  }

  return {
    code,
    revision,
    url: `${cfg.public.siteUrl}/s/${code}`,
    uploadUrl: await r2SignedPut(r2, packKey(code, revision), UPLOAD_URL_TTL),
    maxBytes: MAX_PACK_BYTES,
  }
})
