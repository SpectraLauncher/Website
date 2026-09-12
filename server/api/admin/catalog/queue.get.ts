
export default defineEventHandler(async (event) => {
  await requireModeration(event)

  const query = getQuery(event)
  const status = typeof query.status === 'string' && isProjectStatus(query.status)
    ? [query.status]
    : QUEUED_STATUSES

  // Oldest first: a queue that shows the newest submission on top leaves the
  // person who has waited longest at the bottom of the page.
  const list = await listProjects({
    type: typeof query.type === 'string' ? query.type : undefined,
    statuses: status,
    sort: 'created',
    direction: 'asc',
    offset: Number(query.offset) || 0,
    limit: Math.min(Number(query.limit) || 25, 100),
  })

  const owners = await Promise.all(list.hits.map(row => projectOwner(row.owner_id, row.org_id)))

  // Two batched queries rather than two per row: what the queue needs beyond
  // the project itself is how many versions it has and whether anything in it
  // failed a scan.
  const ids = list.hits.map(row => row.id)
  const [versions, flagged, reviewers] = await Promise.all([
    versionCounts(ids),
    flaggedCounts(ids),
    reviewersOf(ids),
  ])

  return {
    hits: list.hits.map((row, i) => ({
      ...shortProject(row),
      waiting: Date.now() - num(row.created),
      owner: owners[i] ?? null,
      // The same rules the author saw before submitting, so a moderator is not
      // reading a second opinion about the same project.
      checks: checklistState({
        summary: row.summary,
        description: row.description,
        icon: row.icon,
        license: row.license,
        categories: row.categories,
        links: row.links,
        disclosures: row.disclosures,
        versions: Array.from({ length: versions[row.id] ?? 0 }),
      }),
      flagged: flagged[row.id] ?? 0,
      reviewer: reviewers[row.id] ?? null,
    })),
    total: list.total,
    offset: list.offset,
    limit: list.limit,
    counts: await queueCounts(),
  }
})
