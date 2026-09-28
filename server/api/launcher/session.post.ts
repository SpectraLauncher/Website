import { redeemLauncherSession } from '../../utils/launcher-session'

export default defineEventHandler(event => redeemLauncherSession(event))
