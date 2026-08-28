export default defineEventHandler(() => ({
  providers: enabledProviders(),
  turnstileSiteKey: turnstileSiteKey(),
}))
