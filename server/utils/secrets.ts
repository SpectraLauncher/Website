
export function ingestKey(): string {
  return useRuntimeConfig().ingestKey || process.env.SPECTRA_INGEST_KEY || ''
}
