// What somebody has been doing, from the two halves of the platform at once: the
// launcher knows when they played, the catalog knows what they shipped. The
// profile used to show these as two panels that never met, so a creator's page
// read as a play-time chart and their work was a sidebar list with no dates.
//
// To add a kind: a member here, a branch in profileFeed (server/utils) and a
// line in the registry inside app/components/profile/Feed.vue.
export type ProfileEvent =
  | { kind: 'release', at: number, title: string, path: string, version: string, gameVersions: string[], loaders: string[] }
  | { kind: 'publish', at: number, title: string, path: string, type: string }
  | { kind: 'org', at: number, title: string, path: string, role: string }
  | { kind: 'play', at: number, seconds: number, launches: number }
