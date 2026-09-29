export function useCatalogOpen(): boolean {
  const flag = useRuntimeConfig().public.catalogPublic
  return flag === true || flag === 'true'
}
