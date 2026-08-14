import { isRecord } from './parse-oauth.ts'

/** Minimal TOML reader for CLI config files (tables + quoted/bare strings). */
export function parseSimpleToml(text: string): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  let current: Record<string, unknown> = root
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim()
    if (line.length === 0) continue
    const table = line.match(/^\[\[([^\]]+)\]\]$/) ?? line.match(/^\[([^\]]+)\]$/)
    if (table !== null) {
      current = ensureTable(root, table[1]!)
      continue
    }
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    const value = decodeTomlValue(line.slice(eq + 1).trim())
    current[key] = value
  }
  return root
}

function ensureTable(root: Record<string, unknown>, path: string): Record<string, unknown> {
  let node = root
  for (const part of path.split('.')) {
    const existing = node[part]
    if (isRecord(existing)) {
      node = existing
      continue
    }
    const next: Record<string, unknown> = {}
    node[part] = next
    node = next
  }
  return node
}

function decodeTomlValue(raw: string): unknown {
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw)
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1)
  }
  return raw
}

export function parseDotEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.length === 0 || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key.length > 0 && value.length > 0) env[key] = value
  }
  return env
}
