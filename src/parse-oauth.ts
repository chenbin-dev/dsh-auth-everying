import type { ApiKeyCredential, OAuthCredential } from '@earendil-works/pi-ai'
import { DEFAULT_TOKEN_LIFETIME_MS } from './ids.ts'

export interface ParsedSecret {
  credential: OAuthCredential | ApiKeyCredential
  score: number
  path: string
  accountId?: string
}

const ACCESS_KEYS = ['access', 'access_token', 'accessToken', 'key', 'oauth_token', 'token'] as const
const REFRESH_KEYS = ['refresh', 'refresh_token', 'refreshToken'] as const
const ACCOUNT_KEYS = ['account_id', 'accountId', 'user_id', 'chatgpt_account_id', 'principal_id'] as const
const API_KEY_KEYS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'OPENAI_API_KEY',
  'XAI_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'DEEPSEEK_API_KEY',
  'KIMI_CODE_API_KEY',
  'api_key',
  'apiKey',
  'api-key',
] as const
const SKIP_SEGMENTS = ['mcp', 'mcpServers', 'mcp_servers', 'headers', 'plugin']

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function firstString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = nonEmptyString(record[key])
    if (value !== undefined) return value
  }
  return undefined
}

export function parseTime(value: string): number {
  const parsed = Date.parse(value)
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  const trimmed = value.replace(/(\.\d{3})\d+/, '$1')
  const again = Date.parse(trimmed)
  return Number.isFinite(again) && again > 0 ? again : Number.NaN
}

export function parseExpires(record: Record<string, unknown>): number {
  for (const key of ['expires_at', 'expiresAt', 'expiry_date', 'expiryDate', 'expires']) {
    const value = record[key]
    if (typeof value === 'string' && value.length > 0) {
      const parsed = parseTime(value)
      if (Number.isFinite(parsed)) return parsed
    }
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value < 1_000_000_000_000 ? value * 1000 : value
    }
  }
  const expiresIn = record['expires_in'] ?? record['expiresIn']
  if (typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0) {
    return Date.now() + expiresIn * 1000
  }
  return Date.now() + DEFAULT_TOKEN_LIFETIME_MS
}

function scorePath(path: string, hints: readonly string[]): number {
  const lower = path.toLowerCase()
  let score = 0
  for (const hint of hints) {
    if (lower.includes(hint.toLowerCase())) score += 10
  }
  if (lower.includes('auth.x.ai')) score += 8
  if (lower.includes('oauth')) score += 4
  if (lower.includes('tokens')) score += 3
  return score
}

function skipped(path: string): boolean {
  return path.split('.').some(segment => SKIP_SEGMENTS.includes(segment))
}

function walk(
  value: unknown,
  path: string,
  hints: readonly string[],
  into: ParsedSecret[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, hints, into))
    return
  }
  if (!isRecord(value) || skipped(path)) return

  const access = firstString(value, ACCESS_KEYS)
  const refresh = firstString(value, REFRESH_KEYS)
  const accountId = firstString(value, ACCOUNT_KEYS)
  if (access !== undefined && refresh !== undefined) {
    into.push({
      credential: {
        type: 'oauth',
        access,
        refresh,
        expires: parseExpires(value),
        ...accountId === undefined ? {} : { accountId },
      },
      score: scorePath(path, hints) + 20,
      path,
      ...accountId === undefined ? {} : { accountId },
    })
  }

  const apiKey = firstString(value, API_KEY_KEYS)
  if (apiKey !== undefined && refresh === undefined) {
    into.push({
      credential: { type: 'api_key', key: apiKey },
      score: scorePath(path, hints) + 5,
      path,
    })
  }

  for (const [child, nested] of Object.entries(value)) {
    walk(nested, path.length === 0 ? child : `${path}.${child}`, hints, into)
  }
}

/** Collect OAuth and API-key candidates from a JSON-like document. */
export function collectSecrets(value: unknown, hints: readonly string[] = []): ParsedSecret[] {
  const found: ParsedSecret[] = []
  walk(value, '', hints, found)
  return found.sort((left, right) => right.score - left.score)
}

export function bestSecret(value: unknown, hints: readonly string[] = []): ParsedSecret | undefined {
  return collectSecrets(value, hints)[0]
}

export function parseJsonDocument(text: string, filename: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error(`${filename} is not valid JSON`)
  }
}
