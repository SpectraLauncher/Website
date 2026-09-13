/**
 * The parts of a profile the settings form edits.
 *
 * Read from here rather than from the session: these live in columns this app
 * added, and a column the session does not carry comes back undefined on the
 * next load — the form then looks like the save was lost. The banner did
 * exactly that.
 */
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)

  const row = await one<{
    bio: string | null
    links: Record<string, string> | null
    banner: string | null
  }>('SELECT bio, links, banner FROM "user" WHERE id = $1', [me.id])

  return {
    bio: row?.bio ?? '',
    links: row?.links ?? {},
    banner: row?.banner ?? null,
  }
})
