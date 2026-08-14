/** Strip token-like strings from diagnostics that leave the plugin. */
export function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, '[redacted token]')
    .replace(/(\b(?:code|token|refresh_token|access_token|api[_-]?key|sk-)=)[^&\s]+/giu, '$1[redacted]')
    .replace(/\b(sk-|xai-|gsk_|AIza)[A-Za-z0-9._-]{8,}\b/gu, '[redacted key]')
    .slice(0, 1000)
}

export function hostOf(url: string | undefined): string | undefined {
  if (url === undefined || url.length === 0) return undefined
  try {
    return new URL(url).host
  } catch {
    return undefined
  }
}
