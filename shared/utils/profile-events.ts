// What somebody has done on the platform, in the order they did it. Only acts of
// authorship belong here — shipping a version, publishing a project, joining an
// organization, saying something under one. How long they played is a fact about
// them, not something they did, and it lives in the contributions graph instead.
//
// To add a kind: a member here, a branch in profileFeed (server/utils) and a
// line in the registry inside app/components/profile/Feed.vue.
export type ProfileEvent =
  | { kind: 'release', at: number, title: string, path: string, version: string, gameVersions: string[], loaders: string[] }
  | { kind: 'publish', at: number, title: string, path: string, type: string }
  | { kind: 'comment', at: number, title: string, path: string, excerpt: string }
  | { kind: 'org', at: number, title: string, path: string, role: string }
