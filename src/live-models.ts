import { isRecord } from './parse-oauth.ts'

const BODY_LIMIT = 4 * 1024 * 1024

/** Pull model ids from an OpenAI-shaped listing. Never returns the body. */
export function extractModelIds(body: unknown): string[] {
  const rows = Array.isArray(body)
    ? body
    : isRecord(body) && Array.isArray(body['data'])
      ? body['data']
      : isRecord(body) && Array.isArray(body['models'])
        ? body['models']
        : []
  const ids: string[] = []
  for (const row of rows) {
    if (typeof row === 'string' && row.length > 0) ids.push(row)
    else if (isRecord(row) && typeof row['id'] === 'string' && row['id'].length > 0) ids.push(row['id'])
  }
  return [...new Set(ids)]
}

export async function fetchLiveModelIds(url: string, accessToken: string, signal?: AbortSignal): Promise<string[]> {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    signal,
  })
  const raw = Buffer.from(await response.arrayBuffer())
  if (raw.byteLength > BODY_LIMIT) throw new Error('model listing exceeded 4 MiB')
  const body: unknown = JSON.parse(raw.toString('utf8'))
  if (!response.ok) throw new Error(`model listing failed (HTTP ${response.status})`)
  const ids = extractModelIds(body)
  if (ids.length === 0) throw new Error('model listing contained no ids')
  return ids
}
