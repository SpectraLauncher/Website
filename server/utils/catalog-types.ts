
export const PROJECT_TYPES = ['mod', 'modpack', 'shader', 'resourcepack', 'schematic'] as const
export type ProjectType = typeof PROJECT_TYPES[number]

// Registry: URL prefix per project type. Adding a sixth type means an entry
// here, an entry in PROJECT_TYPES and a page in app/pages/<prefix>/[slug].vue.
export const TYPE_PREFIX: Record<ProjectType, string> = {
  mod: 'mod',
  modpack: 'pack',
  shader: 'shader',
  resourcepack: 'resourcepack',
  schematic: 'schematic',
}

export const VERSION_CHANNELS = ['release', 'beta', 'alpha'] as const
export type VersionChannel = typeof VERSION_CHANNELS[number]

export const PROJECT_STATUSES = [
  'draft',
  'published',
  'unlisted',
  'archived',
  'rejected',
  'removed',
] as const
export type ProjectStatus = typeof PROJECT_STATUSES[number]

// Two different questions, and conflating them is how an unlisted project ends
// up in a sitemap.
//
// LISTED  — may appear in search, listings, facets, the sitemap and feeds.
// LINKABLE — may be opened by anyone holding the address.
//
// Everything outside LINKABLE is 404 to anyone who does not own it.
export const LISTED_STATUSES: readonly ProjectStatus[] = ['published', 'archived']
export const LINKABLE_STATUSES: readonly ProjectStatus[] = ['published', 'archived', 'unlisted']

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return PROJECT_STATUSES.includes(value as ProjectStatus)
}

export function isListed(status: string): boolean {
  return LISTED_STATUSES.includes(status as ProjectStatus)
}

export function isLinkable(status: string): boolean {
  return LINKABLE_STATUSES.includes(status as ProjectStatus)
}

export const DEPENDENCY_KINDS = ['required', 'optional', 'incompatible', 'embedded'] as const
export type DependencyKind = typeof DEPENDENCY_KINDS[number]

// Registry: licences offered in the form. SPDX identifiers except for 'ARR',
// which SPDX has no code for and which is the most common choice in Minecraft
// modding. Anything outside the list goes in as 'other' with project.license_url.
export const LICENSES = [
  'MIT',
  'Apache-2.0',
  'LGPL-3.0-only',
  'LGPL-2.1-only',
  'GPL-3.0-only',
  'MPL-2.0',
  'BSD-3-Clause',
  'ISC',
  'Zlib',
  'Unlicense',
  'CC0-1.0',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'CC-BY-NC-SA-4.0',
  'ARR',
  'other',
] as const
export type License = typeof LICENSES[number]

export function isProjectType(value: unknown): value is ProjectType {
  return PROJECT_TYPES.includes(value as ProjectType)
}

export function isVersionChannel(value: unknown): value is VersionChannel {
  return VERSION_CHANNELS.includes(value as VersionChannel)
}

export function isLicense(value: unknown): value is License {
  return LICENSES.includes(value as License)
}

export function projectPath(type: ProjectType, slug: string): string {
  return `/${TYPE_PREFIX[type]}/${slug}`
}
