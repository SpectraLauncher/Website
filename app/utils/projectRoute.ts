export interface ProjectRouteParts {
  /** The tab to open. A version page counts as the versions tab. */
  tab: string
  /** Empty unless the address names a single version. */
  versionId: string
}

/**
 * Reads what a project page's catch-all segment is asking for.
 *
 * `/mod/terralith` -> the description, `/mod/terralith/versions` -> the list,
 * `/mod/terralith/version/abc123` -> that one version, with the versions tab
 * still marked as the one you are in.
 *
 * Vue Router hands a repeatable parameter over as an array in some versions and
 * as a joined string in others, so both shapes are accepted rather than picked.
 */
export function projectRouteParts(param: unknown): ProjectRouteParts {
  const segments = (Array.isArray(param) ? param : String(param ?? '').split('/'))
    .map(part => String(part ?? '').trim())
    .filter(Boolean)

  const [first = '', second = ''] = segments

  return first === 'version'
    ? { tab: 'versions', versionId: second }
    : { tab: first, versionId: '' }
}
