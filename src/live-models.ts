import { isRecord } from './parse-oauth.ts'

const BODY_LIMIT = 4 * 1024 * 1024

export interface LiveModelInfo {
  id: string
  /** Optional provider-declared reasoning levels for this exact model. */
  reasoningEfforts?: string[]
}

/** Build conventional model-list endpoints without dropping a gateway path prefix. */
export function modelListingUrls(baseURL: string): string[] {
  try {
    const base = new URL(baseURL)
    base.search = ''
    base.hash = ''
    const path = base.pathname.replace(/\/+$/, '')
    const paths = [
      `${path.endsWith('/v1') ? path : `${path}/v1`}/models`,
      `${path}/models`,
    ]
    return [...new Set(paths.map(pathname => {
      const target = new URL(base)
      target.pathname = pathname.startsWith('/') ? pathname : `/${pathname}`
      return target.toString()
    }))]
  } catch {
    return []
  }
}

/** Pull model ids from an OpenAI-shaped listing. Never returns the body. */
function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const values = value.flatMap(item => {
    if (typeof item === 'string' && item.length > 0) return [item]
    if (isRecord(item) && typeof item['id'] === 'string' && item['id'].length > 0) return [item['id']]
    if (isRecord(item) && typeof item['name'] === 'string' && item['name'].length > 0) return [item['name']]
    return []
  })
  return [...new Set(values)]
}

function readReasoningEfforts(row: Record<string, unknown>): string[] | undefined {
  const keys = [
    'reasoning_efforts',
    'reasoningEfforts',
    'supported_reasoning_efforts',
    'supportedReasoningEfforts',
    'thinking_levels',
    'thinkingLevels',
    'efforts',
    'levels',
  ]
  for (const key of keys) {
    const values = stringList(row[key])
    if (values !== undefined) return values
  }
  for (const containerKey of ['reasoning', 'capabilities']) {
    const container = row[containerKey]
    if (!isRecord(container)) continue
    const nested = readReasoningEfforts(container)
    if (nested !== undefined) return nested
  }
  return undefined
}

export function extractModelInfo(body: unknown): LiveModelInfo[] {
  const rows = Array.isArray(body)
    ? body
    : isRecord(body) && Array.isArray(body['data'])
      ? body['data']
      : isRecord(body) && Array.isArray(body['models'])
        ? body['models']
        : []
  const models: LiveModelInfo[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const id = typeof row === 'string'
      ? row
      : isRecord(row) && typeof row['id'] === 'string'
        ? row['id']
        : undefined
    if (id === undefined || id.length === 0 || seen.has(id)) continue
    seen.add(id)
    models.push({
      id,
      ...isRecord(row) && readReasoningEfforts(row) !== undefined
        ? { reasoningEfforts: readReasoningEfforts(row) }
        : {},
    })
  }
  return models
}

export function extractModelIds(body: unknown): string[] {
  return extractModelInfo(body).map(model => model.id)
}

export async function fetchLiveModelIds(url: string, accessToken: string, signal?: AbortSignal): Promise<string[]> {
  return (await fetchLiveModels(url, accessToken, signal)).map(model => model.id)
}

export async function fetchLiveModels(url: string, accessToken: string, signal?: AbortSignal): Promise<LiveModelInfo[]> {
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
  const models = extractModelInfo(body)
  if (models.length === 0) throw new Error('model listing contained no ids')
  return models
}
