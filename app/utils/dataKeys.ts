/**
 * What every cached fetch is called.
 *
 * Nuxt's useAsyncData already is the cache — two callers with the same key share
 * one request, and refreshNuxtData(key) is the invalidation. What was missing is
 * a single place that decides what the key *is*: a save in the settings area had
 * to remember the exact string the public project page happened to use, so in
 * practice nothing was ever refreshed and the open tab went stale.
 *
 * To add a resource: one builder here, used at the fetch and at the refresh.
 */
export const dataKeys = {
  /** The public project page. */
  project: (slug: string) => `project:${slug}`,
  /** Everything the settings area edits. */
  projectEditor: (slug: string) => `project-editor:${slug}`,
  /** Whether the viewer may edit the project they are looking at. */
  projectEditable: (id: string) => `project-editable:${id}`,
  projectMembers: (slug: string) => `project-members:${slug}`,

  org: (slug: string) => `org:${slug}`,

  /** The signed-in account's own bio, links and banner. */
  myProfile: () => 'me-profile',

  /** The three newest articles, shown on the home page. */
  homeNews: () => 'home-news',

  launcherVersion: () => 'launcher-version',
  authProviders: () => 'auth-providers',
} as const

/**
 * Every key that shows a given project.
 *
 * Saving a title changes the public page, the editor and the member list's
 * header all at once; making the caller list them is how one gets forgotten.
 */
export function projectKeys(slug: string, id?: string | null): string[] {
  const keys = [
    dataKeys.project(slug),
    dataKeys.projectEditor(slug),
    dataKeys.projectMembers(slug),
  ]

  if (id) keys.push(dataKeys.projectEditable(id))
  return keys
}
