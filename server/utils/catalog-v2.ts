
import { type FileRow, type ProjectRow, type VersionRow, num } from './catalog'
import { publicContentUrl } from './content-store'

// The wire shape of Modrinth's v2 API, so a launcher or packwiz-style tool
// switches base URL and keeps working. This mirrors their field names and
// nothing else — the storage model behind it is our own.
//
// Deliberately a subset. Their search endpoint encodes facets as nested JSON in
// a query parameter, mapped onto their search backend; reproducing that buys
// nothing, because third-party tools almost never run search against a
// non-Modrinth host. Hash lookup is the endpoint that actually earns its keep.

const CHANNEL_TO_TYPE: Record<string, string> = {
  release: 'release',
  beta: 'beta',
  alpha: 'alpha',
}

function iso(value: string | number | null): string | null {
  const ms = num(value)
  return ms ? new Date(ms).toISOString() : null
}

export function v2File(row: FileRow) {
  return {
    hashes: { sha1: row.sha1, sha512: row.sha512 },
    url: publicContentUrl(row.object_key),
    filename: row.filename,
    primary: row.is_primary,
    size: num(row.size),
    file_type: null,
  }
}

export function v2Version(version: VersionRow, files: FileRow[]) {
  return {
    id: version.id,
    project_id: version.project_id,
    author_id: null,
    featured: false,
    name: version.name || version.number,
    version_number: version.number,
    changelog: version.changelog || null,
    changelog_url: null,
    date_published: iso(version.created),
    downloads: num(version.downloads),
    version_type: CHANNEL_TO_TYPE[version.channel] ?? 'release',
    status: 'listed',
    requested_status: null,
    files: files.map(v2File),
    dependencies: [],
    game_versions: version.game_versions,
    loaders: version.loaders,
  }
}

function link(links: Record<string, string>, ...names: string[]): string | null {
  for (const name of names) {
    if (links[name]) return links[name]!
  }
  return null
}

export function v2Project(project: ProjectRow, versionIds: string[]) {
  const links = project.links ?? {}

  return {
    id: project.id,
    slug: project.slug,
    project_type: project.type,
    team: project.org_id ?? project.owner_id,
    organization: project.org_id,
    title: project.title,
    // Their `description` is the one-line summary and `body` is the long text.
    // Ours are named the other way round, which is exactly the kind of thing
    // that silently ships a project page into a tooltip.
    description: project.summary,
    body: project.description,
    body_url: null,
    published: iso(project.published ?? project.created),
    updated: iso(project.updated),
    approved: iso(project.published),
    queued: null,
    status: project.status === 'published' ? 'approved' : 'draft',
    requested_status: null,
    moderator_message: null,
    license: project.license
      ? { id: project.license, name: project.license, url: project.license_url }
      : null,
    downloads: num(project.downloads),
    followers: project.follows,
    categories: project.categories,
    additional_categories: [],
    game_versions: project.game_versions,
    loaders: project.loaders,
    versions: versionIds,
    icon_url: project.icon,
    issues_url: link(links, 'issues'),
    source_url: link(links, 'sources', 'source'),
    wiki_url: link(links, 'wiki'),
    discord_url: link(links, 'discord'),
    donation_urls: [],
    gallery: [],
    color: null,
    monetization_status: 'monetized',
  }
}
