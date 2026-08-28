
import { createAuthClient } from 'better-auth/vue'
import { oneTimeTokenClient, twoFactorClient, usernameClient } from 'better-auth/client/plugins'

const client = createAuthClient({
  plugins: [usernameClient(), twoFactorClient(), oneTimeTokenClient()],
})

export const useAuthClient = () => client
export const useAuthSession = () => client.useSession()

export function initialsAvatar(name?: string | null) {
  const label = (name || '?').trim()
  let hash = 0
  for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) % 360
  return { letter: label[0]!.toUpperCase(), hue: hash }
}
