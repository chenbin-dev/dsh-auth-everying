/** Harness-home document owned by this bundle. */
export const STORE_FILENAME = '.auth-everying.json'

/** Web route prefix. */
export const PLUGIN_PATH = '/plugins/dsh-auth-everying'

export const AUTH_STATUS_PATH = `${PLUGIN_PATH}/auth/status`
export const AUTH_IMPORT_PATH = `${PLUGIN_PATH}/auth/import`
export const AUTH_IMPORT_ALL_PATH = `${PLUGIN_PATH}/auth/import-all`
export const AUTH_LOGIN_PATH = `${PLUGIN_PATH}/auth/login`
export const AUTH_LOGOUT_PATH = `${PLUGIN_PATH}/auth/logout`
export const AUTH_MODELS_PATH = `${PLUGIN_PATH}/auth/models`

export const STREAM_IDLE_TIMEOUT_MS = 300_000
export const DEFAULT_CONTEXT_WINDOW = 262_144
export const DEFAULT_MAX_TOKENS = 32_768
export const DEFAULT_TOKEN_LIFETIME_MS = 60 * 60 * 1000

export type OfficialPlatformId = 'claude' | 'codex' | 'grok' | 'gemini' | 'copilot' | 'opencode'

export type WireApi = 'anthropic-messages' | 'openai-completions' | 'openai-responses' | 'openai-codex-responses'

export interface OfficialPlatform {
  id: OfficialPlatformId
  route: string
  piProvider: string
  displayName: string
  defaultModel: string
  canLogin: boolean
  liveModelsUrl?: string
}

export const OFFICIAL_PLATFORMS: readonly OfficialPlatform[] = [
  {
    id: 'claude',
    route: 'claude-oauth',
    piProvider: 'anthropic',
    displayName: 'Claude',
    defaultModel: 'claude-sonnet-4-5',
    canLogin: true,
  },
  {
    id: 'codex',
    route: 'codex-oauth',
    piProvider: 'openai-codex',
    displayName: 'Codex',
    defaultModel: 'gpt-5.4',
    canLogin: true,
  },
  {
    id: 'grok',
    route: 'grok-oauth',
    piProvider: 'xai',
    displayName: 'Grok',
    defaultModel: 'grok-4.6',
    canLogin: true,
    liveModelsUrl: 'https://api.x.ai/v1/models',
  },
  {
    id: 'gemini',
    route: 'gemini-oauth',
    piProvider: 'google',
    displayName: 'Gemini',
    defaultModel: 'gemini-2.5-pro',
    canLogin: false,
  },
  {
    id: 'copilot',
    route: 'copilot-oauth',
    piProvider: 'github-copilot',
    displayName: 'GitHub Copilot',
    defaultModel: 'gpt-5.4',
    canLogin: true,
  },
  {
    id: 'opencode',
    route: 'opencode-oauth',
    piProvider: 'opencode',
    displayName: 'OpenCode',
    defaultModel: 'gpt-5.4',
    canLogin: false,
  },
]

export function officialById(id: string): OfficialPlatform | undefined {
  return OFFICIAL_PLATFORMS.find(platform => platform.id === id)
}

export function officialByRoute(route: string): OfficialPlatform | undefined {
  return OFFICIAL_PLATFORMS.find(platform => platform.route === route)
}

export function officialByPi(piProvider: string): OfficialPlatform | undefined {
  return OFFICIAL_PLATFORMS.find(platform => platform.piProvider === piProvider)
}

/** Models the installed pi-ai catalog has not caught up with yet. */
export const EXTRA_CATALOG_MODELS: Partial<Record<OfficialPlatformId, readonly string[]>> = {
  grok: ['grok-4.6'],
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug.length > 0 ? slug : 'custom'
}
