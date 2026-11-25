
// Packs this account may push to: the ones it owns and the ones it was made a
// collaborator on. A collaborator's row carries no instance_id — that id names
// the owner's local copy and would only confuse the collaborator's launcher.
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const now = Date.now()

  // The address is built here, the way share.post.ts builds it, so the launcher
  // does not have to know the shape of our URLs or hardcode our domain.
  const site = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')

  const rows = await q<any>(
    `SELECT s.code, s.instance_id, s.name, s.mc_version, s.loader, s.mods, s.revision, s.created,
            s.expires, s.downloads, s.size, s.owner_id,
            u.name AS owner_name, u.username AS owner_username, u.image AS owner_image
     FROM shares s LEFT JOIN "user" u ON u.id = s.owner_id
     WHERE s.expires > $2 AND s.uploaded = TRUE
       AND (s.owner_id = $1 OR EXISTS (
         SELECT 1 FROM share_recipient r WHERE r.code = s.code AND r.user_id = $1 AND r.can_push))
     ORDER BY s.created DESC`,
    [me.id, now],
  )
  if (!rows.length) return { shares: [] }

  const recipients = await q<any>(
    `SELECT r.code, r.imported_revision, r.can_push, u.id, u.name, u.username, u.image
     FROM share_recipient r JOIN "user" u ON u.id = r.user_id
     WHERE r.code = ANY($1::text[])`,
    [rows.map(r => r.code)],
  )

  return {
    shares: rows.map(({ owner_id, owner_name, owner_username, owner_image, ...s }) => {
      const role = owner_id === me.id ? 'owner' : 'collaborator'
      return {
        ...s,
        instance_id: role === 'owner' ? s.instance_id : null,
        role,
        owner: { id: owner_id, name: owner_name, username: owner_username, image: owner_image },
        url: `${site}/s/${s.code}`,
        created: Number(s.created),
        expires: Number(s.expires),
        size: Number(s.size),
        canExtend: Number(s.expires) - now <= EXTEND_WINDOW_MS,
        recipients: recipients
          .filter(r => r.code === s.code)
          .map(r => ({
            user: { id: r.id, name: r.name, username: r.username, image: r.image },
            importedRevision: r.imported_revision,
            outdated: (r.imported_revision ?? 0) < s.revision,
            canPush: r.can_push,
          })),
      }
    }),
  }
})
