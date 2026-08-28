
declare global {
  interface Window {
    umami?: { track: (name: string, data?: Record<string, unknown>) => void }
  }
}

export function track(event: string, data?: Record<string, unknown>): void {
  if (!import.meta.client) return

  try {
    window.umami?.track(event, data)
  }
  catch { /* analityka nigdy nie moze przeszkodzic w dzialaniu strony */ }
}
