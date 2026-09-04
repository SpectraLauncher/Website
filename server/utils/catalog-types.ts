
export const PROJECT_TYPES = ['mod', 'modpack', 'shader', 'resourcepack', 'schematic'] as const
export type ProjectType = typeof PROJECT_TYPES[number]

// Rejestr: prefiks URL na typ projektu. Dodanie szostego typu to wpis tutaj,
// wpis w PROJECT_TYPES i strona w app/pages/<prefiks>/[slug].vue.
export const TYPE_PREFIX: Record<ProjectType, string> = {
  mod: 'mod',
  modpack: 'pack',
  shader: 'shader',
  resourcepack: 'resourcepack',
  schematic: 'schematic',
}

export const VERSION_CHANNELS = ['release', 'beta', 'alpha'] as const
export type VersionChannel = typeof VERSION_CHANNELS[number]

export const PROJECT_STATUSES = ['draft', 'published', 'archived', 'removed'] as const
export type ProjectStatus = typeof PROJECT_STATUSES[number]

export const DEPENDENCY_KINDS = ['required', 'optional', 'incompatible', 'embedded'] as const
export type DependencyKind = typeof DEPENDENCY_KINDS[number]

// Rejestr: licencje do wyboru w formularzu. Identyfikatory SPDX poza 'ARR',
// ktore SPDX nie ma, a ktore w modowaniu Minecrafta jest najczestszym wyborem.
// Cokolwiek spoza listy idzie jako 'other' razem z project.license_url.
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
