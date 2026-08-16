import { execFile } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { promisify } from 'node:util'
import type { ApiKeyCredential, Credential, OAuthCredential } from '@earendil-works/pi-ai'
import {
  type OfficialPlatformId,
  type WireApi,
  officialById,
  slugify,
} from './ids.ts'
import { bestSecret, isRecord, nonEmptyString, parseJsonDocument } from './parse-oauth.ts'
import { CLAUDE_KEYCHAIN_SERVICES, LIVE_PATHS } from './paths.ts'
import { hostOf } from './redact.ts'
import { parseDotEnv, parseSimpleToml } from './toml.ts'

const execFileAsync = promisify(execFile)

export type SourceKind = 'oauth' | 'api_key'

export interface DiscoveredSource {
  id: string
  platform: OfficialPlatformId | 'custom'
  displayName: string
  origin: string
  path: string
  kind: SourceKind
  importable: boolean
  baseURL?: string
  baseHost?: string
  model?: string
  models?: string[]
  /** Configured default effort for the source's selected model. */
  modelReasoningEffort?: string
  api?: WireApi
  envKey?: string
}

export interface ImportableSource extends DiscoveredSource {
  credential: Credential
}

function exists(filename: string): Promise<boolean> {
  return stat(filename).then(() => true, () => false)
}

async function readText(filename: string): Promise<string | undefined> {
  try {
    return await readFile(filename, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

function apiKeyCredential(key: string): ApiKeyCredential {
  return { type: 'api_key', key }
}

function guessApi(platform: OfficialPlatformId | 'custom', baseURL?: string): WireApi {
  if (platform === 'claude') return 'anthropic-messages'
  if (platform === 'codex') return 'openai-codex-responses'
  if (platform === 'gemini') return 'openai-completions'
  if (baseURL?.includes('anthropic') || baseURL?.includes('api.moonshot') || baseURL?.includes('kimi')) {
    return 'anthropic-messages'
  }
  return 'openai-completions'
}

function source(
  partial: Omit<DiscoveredSource, 'importable' | 'baseHost'> & { credential?: Credential },
): ImportableSource | DiscoveredSource {
  const base: DiscoveredSource = {
    ...partial,
    importable: partial.credential !== undefined,
    ...hostOf(partial.baseURL) === undefined ? {} : { baseHost: hostOf(partial.baseURL) },
    ...partial.api === undefined ? { api: guessApi(partial.platform, partial.baseURL) } : {},
  }
  if (partial.credential === undefined) return base
  return { ...base, credential: partial.credential }
}

async function fromClaudeSettings(): Promise<Array<ImportableSource | DiscoveredSource>> {
  const out: Array<ImportableSource | DiscoveredSource> = []
  for (const path of [LIVE_PATHS.claudeSettings, LIVE_PATHS.claudeLocalSettings]) {
    const text = await readText(path)
    if (text === undefined) continue
    const data = parseJsonDocument(text, path)
    const env = isRecord(data) && isRecord(data['env']) ? data['env'] : {}
    const key = nonEmptyString(env['ANTHROPIC_API_KEY']) ?? nonEmptyString(env['ANTHROPIC_AUTH_TOKEN'])
    const baseURL = nonEmptyString(env['ANTHROPIC_BASE_URL'])
    const model = nonEmptyString(env['ANTHROPIC_MODEL']) ?? nonEmptyString(env['ANTHROPIC_DEFAULT_SONNET_MODEL'])
    out.push(source({
      id: `live:claude:${path}`,
      platform: 'claude',
      displayName: 'Claude settings.json',
      origin: 'Claude Code',
      path,
      kind: key === undefined ? 'oauth' : 'api_key',
      baseURL,
      model,
      api: 'anthropic-messages',
      ...key === undefined ? {} : { credential: apiKeyCredential(key) },
    }))
  }
  if (await exists(LIVE_PATHS.claudeJson)) {
    out.push(source({
      id: 'live:claude-json',
      platform: 'claude',
      displayName: 'Claude ~/.claude.json',
      origin: 'Claude Code',
      path: LIVE_PATHS.claudeJson,
      kind: 'oauth',
    }))
  }
  return out
}

async function fromKeychain(): Promise<Array<ImportableSource | DiscoveredSource>> {
  if (process.platform !== 'darwin') return []
  for (const service of CLAUDE_KEYCHAIN_SERVICES) {
    try {
      const { stdout } = await execFileAsync('security', ['find-generic-password', '-s', service, '-w'], {
        timeout: 4000,
        maxBuffer: 2 * 1024 * 1024,
      })
      const text = stdout.trim()
      if (text.length === 0) continue
      let value: unknown = text
      try {
        value = JSON.parse(text) as unknown
      } catch {
        // raw token string
      }
      const secret = typeof value === 'string'
        ? { credential: apiKeyCredential(value) as Credential, score: 1, path: service }
        : bestSecret(value, ['claude', 'anthropic', 'oauth'])
      return [source({
        id: `keychain:${service}`,
        platform: 'claude',
        displayName: 'Claude Code keychain',
        origin: 'macOS Keychain',
        path: `keychain:${service}`,
        kind: secret?.credential.type === 'oauth' ? 'oauth' : 'api_key',
        api: 'anthropic-messages',
        ...secret === undefined ? {} : { credential: secret.credential },
      })]
    } catch {
      continue
    }
  }
  return []
}

async function fromCodex(): Promise<Array<ImportableSource | DiscoveredSource>> {
  const out: Array<ImportableSource | DiscoveredSource> = []
  const authText = await readText(LIVE_PATHS.codexAuth)
  if (authText !== undefined) {
    const data = parseJsonDocument(authText, LIVE_PATHS.codexAuth)
    const secret = bestSecret(data, ['codex', 'openai', 'chatgpt', 'tokens'])
    out.push(source({
      id: 'live:codex-auth',
      platform: 'codex',
      displayName: 'Codex auth.json',
      origin: 'Codex CLI',
      path: LIVE_PATHS.codexAuth,
      kind: secret?.credential.type === 'oauth' ? 'oauth' : 'api_key',
      api: secret?.credential.type === 'oauth' ? 'openai-codex-responses' : 'openai-completions',
      ...secret === undefined ? {} : { credential: secret.credential },
    }))
  }
  const tomlText = await readText(LIVE_PATHS.codexConfig)
  if (tomlText !== undefined) {
    const data = parseSimpleToml(tomlText)
    const model = nonEmptyString(data['model'])
    const baseURL = nonEmptyString(data['base_url']) ?? nonEmptyString(data['openai_base_url'])
    if (model !== undefined || baseURL !== undefined) {
      out.push(source({
        id: 'live:codex-config',
        platform: 'codex',
        displayName: 'Codex config.toml',
        origin: 'Codex CLI',
        path: LIVE_PATHS.codexConfig,
        kind: 'api_key',
        baseURL,
        model,
      }))
    }
  }
  return out
}

async function fromGrok(): Promise<Array<ImportableSource | DiscoveredSource>> {
  const out: Array<ImportableSource | DiscoveredSource> = []
  const authText = await readText(LIVE_PATHS.grokAuth)
  if (authText !== undefined) {
    const secret = bestSecret(parseJsonDocument(authText, LIVE_PATHS.grokAuth), ['xai', 'grok', 'auth.x.ai'])
    out.push(source({
      id: 'live:grok-auth',
      platform: 'grok',
      displayName: 'Grok CLI auth.json',
      origin: 'Grok CLI',
      path: LIVE_PATHS.grokAuth,
      kind: 'oauth',
      api: 'openai-responses',
      ...secret === undefined ? {} : { credential: secret.credential },
    }))
  }
  const tomlText = await readText(LIVE_PATHS.grokConfig)
  if (tomlText === undefined) return out
  const data = parseSimpleToml(tomlText)
  const models = isRecord(data['model']) ? data['model'] : {}
  for (const [name, spec] of Object.entries(models)) {
    if (!isRecord(spec)) continue
    const key = nonEmptyString(spec['api_key'])
    const envKey = nonEmptyString(spec['env_key'])
    const envValue = envKey === undefined ? undefined : nonEmptyString(process.env[envKey])
    const credential = key ?? envValue
    out.push(source({
      id: `live:grok-model:${name}`,
      platform: 'custom',
      displayName: nonEmptyString(spec['name']) ?? name,
      origin: 'Grok config.toml',
      path: LIVE_PATHS.grokConfig,
      kind: 'api_key',
      baseURL: nonEmptyString(spec['base_url']),
      model: nonEmptyString(spec['model']) ?? name,
      api: 'openai-completions',
      envKey,
      ...credential === undefined ? {} : { credential: apiKeyCredential(credential) },
    }))
  }
  return out
}

async function fromGemini(): Promise<Array<ImportableSource | DiscoveredSource>> {
  const out: Array<ImportableSource | DiscoveredSource> = []
  for (const path of [LIVE_PATHS.geminiEnv, LIVE_PATHS.geminiConfigEnv]) {
    const text = await readText(path)
    if (text === undefined) continue
    const env = parseDotEnv(text)
    const key = env['GEMINI_API_KEY'] ?? env['GOOGLE_API_KEY']
    out.push(source({
      id: `live:gemini:${path}`,
      platform: 'gemini',
      displayName: 'Gemini .env',
      origin: 'Gemini CLI',
      path,
      kind: 'api_key',
      baseURL: env['GOOGLE_GEMINI_BASE_URL'] ?? env['GEMINI_BASE_URL'],
      model: env['GEMINI_MODEL'],
      api: 'openai-completions',
      ...key === undefined ? {} : { credential: apiKeyCredential(key) },
    }))
  }
  const oauthText = await readText(LIVE_PATHS.geminiOauth)
  if (oauthText !== undefined) {
    const secret = bestSecret(parseJsonDocument(oauthText, LIVE_PATHS.geminiOauth), ['google', 'gemini'])
    out.push(source({
      id: 'live:gemini-oauth',
      platform: 'gemini',
      displayName: 'Gemini oauth_creds.json',
      origin: 'Gemini CLI',
      path: LIVE_PATHS.geminiOauth,
      kind: 'oauth',
      ...secret === undefined ? {} : { credential: secret.credential },
    }))
  }
  return out
}

async function fromOpenCode(): Promise<Array<ImportableSource | DiscoveredSource>> {
  const out: Array<ImportableSource | DiscoveredSource> = []
  const jsonText = await readText(LIVE_PATHS.opencodeJson)
  if (jsonText !== undefined) {
    const data = parseJsonDocument(jsonText, LIVE_PATHS.opencodeJson)
    const providers = isRecord(data) && isRecord(data['provider']) ? data['provider'] : {}
    if (Object.keys(providers).length === 0) {
      out.push(source({
        id: 'live:opencode-json',
        platform: 'opencode',
        displayName: 'OpenCode opencode.json',
        origin: 'OpenCode',
        path: LIVE_PATHS.opencodeJson,
        kind: 'api_key',
      }))
    }
    for (const [name, spec] of Object.entries(providers)) {
      if (!isRecord(spec)) continue
      const options = isRecord(spec['options']) ? spec['options'] : spec
      const key = nonEmptyString(options['apiKey']) ?? nonEmptyString(options['api_key'])
      const models = isRecord(spec['models']) ? Object.keys(spec['models']) : []
      out.push(source({
        id: `live:opencode:${name}`,
        platform: 'opencode',
        displayName: name,
        origin: 'OpenCode',
        path: LIVE_PATHS.opencodeJson,
        kind: 'api_key',
        baseURL: nonEmptyString(options['baseURL']) ?? nonEmptyString(options['baseUrl']),
        models,
        model: models[0],
        api: 'openai-completions',
        ...key === undefined ? {} : { credential: apiKeyCredential(key) },
      }))
    }
  }
  const authText = await readText(LIVE_PATHS.opencodeAuth)
  if (authText !== undefined) {
    const data = parseJsonDocument(authText, LIVE_PATHS.opencodeAuth)
    if (isRecord(data)) {
      for (const [name, spec] of Object.entries(data)) {
        const secret = bestSecret(spec, [name, 'anthropic', 'openai', 'google', 'xai'])
        const platform = name.includes('anthropic') || name.includes('claude')
          ? 'claude'
          : name.includes('openai') || name.includes('codex')
            ? 'codex'
            : name.includes('google') || name.includes('gemini')
              ? 'gemini'
              : name.includes('xai') || name.includes('grok')
                ? 'grok'
                : 'opencode'
        out.push(source({
          id: `live:opencode-auth:${name}`,
          platform,
          displayName: `OpenCode ${name}`,
          origin: 'OpenCode auth.json',
          path: LIVE_PATHS.opencodeAuth,
          kind: secret?.credential.type === 'oauth' ? 'oauth' : 'api_key',
          ...secret === undefined ? {} : { credential: secret.credential },
        }))
      }
    }
  }
  return out
}

async function fromOpenClaw(): Promise<Array<ImportableSource | DiscoveredSource>> {
  const text = await readText(LIVE_PATHS.openclaw)
  if (text === undefined) return []
  const data = parseJsonDocument(text.replace(/\/\/[^\n]*/g, ''), LIVE_PATHS.openclaw)
  const models = isRecord(data) && isRecord(data['models']) ? data['models'] : {}
  const providers = isRecord(models['providers']) ? models['providers'] : {}
  const out: Array<ImportableSource | DiscoveredSource> = []
  for (const [name, spec] of Object.entries(providers)) {
    if (!isRecord(spec)) continue
    const key = nonEmptyString(spec['apiKey']) ?? nonEmptyString(spec['api_key'])
    const listed = Array.isArray(spec['models'])
      ? spec['models'].flatMap(item => isRecord(item) && typeof item['id'] === 'string' ? [item['id']] : [])
      : []
    out.push(source({
      id: `live:openclaw:${name}`,
      platform: 'custom',
      displayName: name,
      origin: 'OpenClaw',
      path: LIVE_PATHS.openclaw,
      kind: 'api_key',
      baseURL: nonEmptyString(spec['baseUrl']) ?? nonEmptyString(spec['baseURL']),
      models: listed,
      model: listed[0],
      api: spec['api'] === 'anthropic-messages' ? 'anthropic-messages' : 'openai-completions',
      ...key === undefined ? {} : { credential: apiKeyCredential(key) },
    }))
  }
  return out
}

function ccSwitchPlatform(appType: string): OfficialPlatformId | 'custom' {
  if (appType === 'claude' || appType === 'codex' || appType === 'gemini' || appType === 'opencode') return appType
  if (appType === 'grok' || appType === 'grokbuild') return 'grok'
  return 'custom'
}

/** Parse a CC Switch provider row while retaining its configured gateway semantics. */
export function fromCcSwitchConfig(
  id: string,
  appType: string,
  name: string,
  configText: string,
): ImportableSource | DiscoveredSource | undefined {
  let config: unknown
  try {
    config = JSON.parse(configText) as unknown
  } catch {
    return undefined
  }
  const env = isRecord(config) && isRecord(config['env']) ? config['env'] : {}
  const auth = isRecord(config) && isRecord(config['auth']) ? config['auth'] : {}
  const toml = isRecord(config) && typeof config['config'] === 'string'
    ? parseSimpleToml(config['config'])
    : {}
  const platform = ccSwitchPlatform(appType)
  const official = officialById(platform === 'custom' ? '' : platform)
  const anthropicKey = nonEmptyString(env['ANTHROPIC_API_KEY']) ?? nonEmptyString(env['ANTHROPIC_AUTH_TOKEN'])
  const openaiKey = nonEmptyString(auth['OPENAI_API_KEY']) ?? nonEmptyString(env['OPENAI_API_KEY'])
  const geminiKey = nonEmptyString(env['GEMINI_API_KEY'])
  const secret = bestSecret({ env, auth, config }, [appType, name, platform])
  const credential = anthropicKey !== undefined
    ? apiKeyCredential(anthropicKey)
    : openaiKey !== undefined
      ? apiKeyCredential(openaiKey)
      : geminiKey !== undefined
        ? apiKeyCredential(geminiKey)
        : secret?.credential
  const providerName = nonEmptyString(toml['model_provider'])
  const provider = providerName === undefined || !isRecord(toml['model_providers'])
    ? {}
    : isRecord(toml['model_providers'][providerName])
      ? toml['model_providers'][providerName]
      : {}
  const wireApi = nonEmptyString(provider['wire_api'])
  const modelReasoningEffort = nonEmptyString(toml['model_reasoning_effort'])
  const models = [
    nonEmptyString(env['ANTHROPIC_MODEL']),
    nonEmptyString(env['ANTHROPIC_DEFAULT_SONNET_MODEL']),
    nonEmptyString(env['ANTHROPIC_DEFAULT_OPUS_MODEL']),
    nonEmptyString(env['ANTHROPIC_DEFAULT_HAIKU_MODEL']),
    nonEmptyString(toml['model']),
  ].filter((item): item is string => item !== undefined)
  const baseURL = nonEmptyString(env['ANTHROPIC_BASE_URL'])
    ?? nonEmptyString(env['OPENAI_BASE_URL'])
    ?? nonEmptyString(env['GEMINI_BASE_URL'])
    ?? nonEmptyString(provider['base_url'])
    ?? nonEmptyString(toml['base_url'])
  return source({
    id: `ccswitch:${appType}:${id}`,
    platform,
    displayName: `${name} (CC Switch)`,
    origin: 'CC Switch',
    path: LIVE_PATHS.ccSwitchDb,
    kind: credential?.type === 'oauth' ? 'oauth' : 'api_key',
    baseURL,
    models,
    model: models[0],
    ...modelReasoningEffort === undefined ? {} : { modelReasoningEffort },
    api: wireApi === 'responses'
      ? 'openai-responses'
      : anthropicKey !== undefined || baseURL !== undefined && platform === 'claude'
      ? 'anthropic-messages'
      : official?.id === 'codex' && credential?.type === 'oauth'
        ? 'openai-codex-responses'
        : guessApi(platform, baseURL),
    ...credential === undefined ? {} : { credential },
  })
}

async function fromCcSwitch(): Promise<Array<ImportableSource | DiscoveredSource>> {
  if (!await exists(LIVE_PATHS.ccSwitchDb)) return []
  try {
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(LIVE_PATHS.ccSwitchDb, { readOnly: true })
    try {
      const rows = db.prepare('SELECT id, app_type, name, settings_config FROM providers').all() as Array<{
        id: string
        app_type: string
        name: string
        settings_config: string
      }>
      return rows.flatMap(row => {
        const item = fromCcSwitchConfig(row.id, row.app_type, row.name, row.settings_config)
        return item === undefined ? [] : [item]
      })
    } finally {
      db.close()
    }
  } catch {
    return [source({
      id: 'ccswitch:db',
      platform: 'custom',
      displayName: 'CC Switch database',
      origin: 'CC Switch',
      path: LIVE_PATHS.ccSwitchDb,
      kind: 'api_key',
    })]
  }
}

async function fromProcessEnv(): Promise<Array<ImportableSource | DiscoveredSource>> {
  const mapping: Array<[OfficialPlatformId, string, WireApi]> = [
    ['claude', 'ANTHROPIC_API_KEY', 'anthropic-messages'],
    ['claude', 'ANTHROPIC_AUTH_TOKEN', 'anthropic-messages'],
    ['codex', 'OPENAI_API_KEY', 'openai-completions'],
    ['grok', 'XAI_API_KEY', 'openai-completions'],
    ['gemini', 'GEMINI_API_KEY', 'openai-completions'],
  ]
  return mapping.flatMap(([platform, envKey, api]) => {
    const key = nonEmptyString(process.env[envKey])
    if (key === undefined) return []
    return [source({
      id: `env:${envKey}`,
      platform,
      displayName: envKey,
      origin: 'process env',
      path: `env:${envKey}`,
      kind: 'api_key',
      api,
      envKey,
      credential: apiKeyCredential(key),
    })]
  })
}

export function isImportable(item: DiscoveredSource | ImportableSource): item is ImportableSource {
  return 'credential' in item && item.credential !== undefined
}

export function publicSource(item: DiscoveredSource | ImportableSource): DiscoveredSource {
  const { credential: _credential, ...rest } = item as ImportableSource
  return rest
}

/** Scan CC Switch + live coding-tool configs. Secrets stay on ImportableSource only. */
export async function discoverSources(): Promise<Array<ImportableSource | DiscoveredSource>> {
  const groups = await Promise.all([
    fromCcSwitch(),
    fromClaudeSettings(),
    fromKeychain(),
    fromCodex(),
    fromGrok(),
    fromGemini(),
    fromOpenCode(),
    fromOpenClaw(),
    fromProcessEnv(),
  ])
  const seen = new Set<string>()
  const merged: Array<ImportableSource | DiscoveredSource> = []
  for (const item of groups.flat()) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    merged.push(item)
  }
  return merged
}

export function routeForDiscovered(item: DiscoveredSource): string {
  const official = officialById(item.platform)
  if (official !== undefined && item.origin !== 'Grok config.toml' && item.origin !== 'OpenClaw') {
    if (item.platform !== 'custom' && (item.kind === 'oauth' || item.origin === 'process env' || item.origin === 'Claude Code' || item.origin === 'Codex CLI' || item.origin === 'Grok CLI' || item.origin === 'Gemini CLI' || item.origin === 'macOS Keychain')) {
      if (!(item.origin === 'CC Switch' && item.baseURL !== undefined)) return official.route
    }
  }
  return `auth-everying-${slugify(`${item.origin}-${item.displayName}`)}`
}

export function oauthCredential(item: ImportableSource): OAuthCredential | undefined {
  return item.credential.type === 'oauth' ? item.credential : undefined
}
