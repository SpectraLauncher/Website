
import { exec, one, q } from './db'

export type FriendStatus = 'pending' | 'accepted' | 'blocked'
export type NotificationKind = 'friend_request' | 'friend_accepted' | 'instance_invite' | 'instance_update'

export type Status = 'online' | 'in_game' | 'dnd' | 'offline'

export type PresenceMode = 'visible' | 'dnd' | 'hidden'
export const PRESENCE_MODES: PresenceMode[] = ['visible', 'dnd', 'hidden']

export const PRESENCE_TIMEOUT_MS = 75_000

export function visibleStatus(row: {
  presence?: string | null
  lastSeen?: string | number | null
  playing?: boolean | null
}): Status {
  if ((row.presence ?? 'visible') === 'hidden') return 'offline'
  if (Number(row.lastSeen ?? 0) < Date.now() - PRESENCE_TIMEOUT_MS) return 'offline'
  if (row.playing) return 'in_game'
  return row.presence === 'dnd' ? 'dnd' : 'online'
}

export interface PublicUser {
  id: string
  name: string | null
  username: string | null
  image: string | null
  mcUsername?: string | null
}

const PUBLIC_COLUMNS = 'id, name, username, image, "mcUsername"'

const likePrefix = (s: string) => s.replace(/[\\%_]/g, c => `\\${c}`)

export function findUser(query: string) {
  const q1 = query.trim().toLowerCase()
  if (!q1) return Promise.resolve(undefined)
  // sql-safe: PUBLIC_COLUMNS is a constant column list
  return one<PublicUser>(
    `SELECT ${PUBLIC_COLUMNS} FROM "user"
     WHERE lower(username) = $1 OR lower(email) = $1 OR lower("mcUsername") = $1
     LIMIT 1`,
    [q1],
  )
}

export function searchUsers(query: string, meId: string) {
  const q1 = query.trim().toLowerCase()
  if (q1.length < 2) return Promise.resolve([])

  // sql-safe: PUBLIC_COLUMNS is a constant column list, prefixed with the alias
  return q<PublicUser & { relation: 'friend' | 'pending' | null }>(
    `SELECT ${PUBLIC_COLUMNS.split(', ').map(c => `u.${c}`).join(', ')},
            CASE f.status WHEN 'accepted' THEN 'friend' WHEN 'pending' THEN 'pending' ELSE NULL END AS relation
     FROM "user" u
     LEFT JOIN friendship f
       ON (f.requester_id = u.id AND f.addressee_id = $2)
       OR (f.addressee_id = u.id AND f.requester_id = $2)
     WHERE u.id <> $2
       AND (lower(u.username) LIKE $3 || '%' ESCAPE '\'
            OR lower(u."mcUsername") LIKE $3 || '%' ESCAPE '\')
       AND coalesce(f.status, '') <> 'blocked'
     -- Exact hits first, so typing a full name puts it at the top.
     ORDER BY (lower(u.username) = $1 OR lower(u."mcUsername") = $1) DESC,
              lower(coalesce(u.username, u."mcUsername"))
     LIMIT 8`,
    [q1, meId, likePrefix(q1)],
  )
}

export function getUser(id: string) {
  // sql-safe: PUBLIC_COLUMNS is a constant column list
  return one<PublicUser>(`SELECT ${PUBLIC_COLUMNS} FROM "user" WHERE id = $1`, [id])
}

export async function friendsOf(userId: string) {
  const rows = await q<any>(
    `SELECT u.id, u.name, u.username, u.image, u."mcUsername", u.presence, u."lastSeen", u.playing,
            f.id AS "friendshipId"
     FROM friendship f
     JOIN "user" u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     WHERE f.status = 'accepted' AND (f.requester_id = $1 OR f.addressee_id = $1)
     ORDER BY lower(coalesce(u.username, u.name))`,
    [userId],
  )
  return rows.map(({ presence, lastSeen, playing, ...user }) => ({
    ...user,
    status: visibleStatus({ presence, lastSeen, playing }),
  })) as (PublicUser & { friendshipId: number, status: Status })[]
}

export async function pendingFor(userId: string) {
  const rows = await q<any>(
    `SELECT f.id, f.requester_id, f.addressee_id, f.created,
            u.id AS u_id, u.name, u.username, u.image, u."mcUsername"
     FROM friendship f
     JOIN "user" u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     WHERE f.status = 'pending' AND (f.requester_id = $1 OR f.addressee_id = $1)
     ORDER BY f.created DESC`,
    [userId],
  )
  const map = (r: any) => ({
    id: Number(r.id),
    created: Number(r.created),
    user: { id: r.u_id, name: r.name, username: r.username, image: r.image, mcUsername: r.mcUsername } as PublicUser,
  })
  return {
    incoming: rows.filter(r => r.addressee_id === userId).map(map),
    outgoing: rows.filter(r => r.requester_id === userId).map(map),
  }
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  const row = await one(
    `SELECT 1 FROM friendship WHERE status = 'accepted'
       AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
    [a, b],
  )
  return !!row
}

export function clearNotifications(userId: string, kinds: NotificationKind[], opts: {
  actorId?: string
  shareCode?: string
} = {}) {
  return exec(
    `DELETE FROM notification
     WHERE user_id = $1 AND kind = ANY($2::text[])
       AND ($3::text IS NULL OR actor_id = $3)
       AND ($4::text IS NULL OR share_code = $4)`,
    [userId, kinds, opts.actorId ?? null, opts.shareCode ?? null],
  )
}

export function notify(n: {
  userId: string
  kind: NotificationKind
  actorId?: string | null
  shareCode?: string | null
  data?: unknown
}) {
  return exec(
    `INSERT INTO notification (user_id, kind, actor_id, share_code, data, created)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      n.userId,
      n.kind,
      n.actorId ?? null,
      n.shareCode ?? null,
      n.data === undefined ? null : JSON.stringify(n.data),
      Date.now(),
    ],
  )
}
