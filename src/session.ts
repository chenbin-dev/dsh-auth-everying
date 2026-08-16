import { createModels, type MutableModels, type Provider } from '@earendil-works/pi-ai'
import { LlmError, resolveRetryPolicy } from '@deepseek-ai/dsh-llm'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import type { ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type { Credential } from '@earendil-works/pi-ai'
import {
  OFFICIAL_PLATFORMS,
  STREAM_IDLE_TIMEOUT_MS,
  officialById,
  officialByPi,
  officialByRoute,
} from './ids.ts'
import {
  type DiscoveredSource,
  type ImportableSource,
  discoverSources,
  isImportable,
  publicSource,
  routeForDiscovered,
} from './discover.ts'
import { DshAuthEveryingStore, type StoredRoute, authEveryingPath } from './store.ts'
import { catalogModelIds, catalogProvider, customProvider, officialRuntimeProvider } from './providers.ts'

export interface PlatformStatus {
  id: string
  route: string
  displayName: string
  signedIn: boolean
  canLogin: boolean
  kind?: 'oauth' | 'api_key'
  origin?: string
  sourceId?: string
  available: string[]
  enabled: string[]
}

export class DshAuthEveryingSession {
  readonly store: DshAuthEveryingStore
  readonly models: MutableModels
  private onChange: (() => void) | undefined

  constructor(store: DshAuthEveryingStore = new DshAuthEveryingStore(), onChange?: () => void) {
    this.store = store
    this.onChange = onChange
    this.models = createModels({ credentials: store })
    for (const platform of OFFICIAL_PLATFORMS) {
      const provider = catalogProvider(platform.id)
      if (provider !== undefined) this.models.setProvider(provider)
    }
  }

  async discover(): Promise<DiscoveredSource[]> {
    return (await discoverSources()).map(publicSource)
  }

  async importOne(id: string): Promise<DiscoveredSource> {
    const imported = await this.importMany([id])
    const item = imported[0]
    if (item === undefined) throw new Error(`nothing importable at ${id}`)
    return item
  }

  async importMany(ids: readonly string[]): Promise<DiscoveredSource[]> {
    const wanted = new Set(ids)
    const imported: DiscoveredSource[] = []
    for (const item of await discoverSources()) {
      if (!wanted.has(item.id) || !isImportable(item)) continue
      await this.persist(item)
      imported.push(publicSource(item))
    }
    if (imported.length === 0) throw new Error('select at least one importable source')
    this.onChange?.()
    return imported
  }

  async importAll(): Promise<DiscoveredSource[]> {
    const ids = (await discoverSources()).filter(isImportable).map(item => item.id)
    return this.importMany(ids)
  }

  private defaultEnabled(item: ImportableSource, available: string[], officialDefault?: string): string[] {
    const declared = item.models ?? (item.model === undefined ? [] : [item.model])
    const preferred = declared.filter(id => available.includes(id) || declared.length > 0)
    if (preferred.length > 0) return [...new Set(preferred)]
    if (officialDefault !== undefined && available.includes(officialDefault)) return [officialDefault]
    return available.slice(0, 1)
  }

  private async persist(item: ImportableSource): Promise<void> {
    const routeId = routeForDiscovered(item)
    const official = item.platform === 'custom' ? undefined : officialById(item.platform)
    const useOfficial = official !== undefined && routeId === official.route
    const existing = (await this.store.snapshot()).routes[routeId]
    const declared = item.models ?? (item.model === undefined ? [] : [item.model])
    let available = useOfficial
      ? [...new Set([...catalogModelIds(official.id), ...declared])]
      : [...new Set(declared)]
    if (useOfficial && official.liveModelsUrl !== undefined) {
      const token = item.credential.type === 'oauth' ? item.credential.access : item.credential.key
      if (token !== undefined) {
        try {
          const { fetchLiveModelIds } = await import('./live-models.ts')
          available = [...new Set([...available, ...await fetchLiveModelIds(official.liveModelsUrl, token)])]
        } catch {
          // Keep the static catalog when live listing is unavailable.
        }
      }
    }
    if (item.origin === 'CC Switch' && item.platform === 'codex' && item.baseURL !== undefined) {
      const token = item.credential.type === 'oauth' ? item.credential.access : item.credential.key
      if (token !== undefined) {
        try {
          const { fetchLiveModelIds, modelListingUrls } = await import('./live-models.ts')
          for (const url of modelListingUrls(item.baseURL)) {
            try {
              const live = await fetchLiveModelIds(url, token)
              available = [...new Set([...available, ...live])]
              break
            } catch {
              // A few compatible gateways expose /models instead of /v1/models.
            }
          }
        } catch {
          // The declared CC Switch model remains usable when discovery is unavailable.
        }
      }
    }
    const enabled = existing?.enabled.length
      ? existing.enabled
      : this.defaultEnabled(item, available, official?.defaultModel)
    const route: StoredRoute = {
      route: routeId,
      displayName: useOfficial ? official.displayName : item.displayName,
      piProvider: useOfficial ? official.piProvider : routeId,
      api: item.api ?? 'openai-completions',
      models: available,
      enabled,
      ...item.model === undefined ? {} : { configuredModel: item.model },
      ...item.modelReasoningEffort === undefined ? {} : { modelReasoningEffort: item.modelReasoningEffort },
      sourceId: item.id,
      origin: item.origin,
      ...item.baseURL === undefined ? {} : { baseURL: item.baseURL },
    }
    await this.store.putRoute(route, item.credential)
    const catalog = official !== undefined && useOfficial ? catalogProvider(official.id) : undefined
    if (catalog !== undefined) this.models.setProvider(catalog)
  }

  async setEnabled(routeId: string, enabled: readonly string[]): Promise<void> {
    const unique = [...new Set(enabled.filter(id => id.length > 0))]
    const patched = await this.store.patchRoute(routeId, { enabled: unique })
    if (patched === undefined) throw new Error(`route ${routeId} is not imported`)
    this.onChange?.()
  }

  async status(): Promise<{ platforms: PlatformStatus[]; discovered: Array<DiscoveredSource & { imported: boolean }> }> {
    await this.refreshStaleCcSwitchRoutes()
    const document = await this.store.snapshot()
    const importedSources = new Set(Object.values(document.routes).map(route => route.sourceId))
    const discovered = (await this.discover()).map(item => ({ ...item, imported: importedSources.has(item.id) }))
    const platforms: PlatformStatus[] = []
    for (const route of Object.values(document.routes)) {
      const official = officialByRoute(route.route)
      const available = official === undefined
        ? route.models
        : [...new Set([...catalogModelIds(official.id), ...route.models])]
      platforms.push({
        id: official?.id ?? route.route,
        route: route.route,
        displayName: route.displayName,
        signedIn: true,
        canLogin: official?.canLogin ?? false,
        origin: route.origin,
        sourceId: route.sourceId,
        available,
        enabled: route.enabled,
        kind: (document.credentials[route.piProvider] ?? document.credentials[route.route])?.type === 'oauth'
          ? 'oauth'
          : 'api_key',
      })
    }
    return { platforms, discovered }
  }

  /**
   * Earlier versions missed CC Switch model and reasoning metadata. Refresh only
   * stale routes so existing imports recover without replacing user choices.
   */
  private async refreshStaleCcSwitchRoutes(): Promise<void> {
    const document = await this.store.snapshot()
    const sources = new Map((await discoverSources()).filter(isImportable).map(item => [item.id, item]))
    for (const route of Object.values(document.routes)) {
      if (route.origin !== 'CC Switch') continue
      const item = sources.get(route.sourceId)
      if (item === undefined || item.baseURL === undefined || item.platform !== 'codex') continue
      const missingModels = route.models.length === 0
      const staleReasoning = item.modelReasoningEffort !== undefined
        && (route.configuredModel !== item.model || route.modelReasoningEffort !== item.modelReasoningEffort)
      if (!missingModels && !staleReasoning) continue
      await this.persist(item)
    }
  }

  async logout(id?: string): Promise<void> {
    if (id === undefined || id === 'all') {
      await this.store.clearAll()
      this.onChange?.()
      return
    }
    const official = officialById(id) ?? officialByRoute(id)
    await this.store.delete(official?.route ?? official?.piProvider ?? id)
    this.onChange?.()
  }

  async resolveAccess(route: string): Promise<string> {
    const document = await this.store.snapshot()
    const official = officialById(route) ?? officialByPi(route)
    const stored = document.routes[route]
    const providerId = official?.piProvider ?? stored?.piProvider ?? route
    const auth = await this.models.getAuth(providerId)
    const apiKey = auth?.auth.apiKey
    if (apiKey !== undefined && apiKey.length > 0) return apiKey
    const credential: Credential | undefined = document.credentials[providerId] ?? document.credentials[route]
    if (credential?.type === 'api_key' && credential.key !== undefined) return credential.key
    if (credential?.type === 'oauth') return credential.access
    throw new LlmError(
      `${official?.displayName ?? route} is not imported. Open Settings → dsh-auth-everying and import a local login.`,
      'MISSING_CREDENTIAL',
    )
  }

  async profiles(): Promise<Map<string, ResolvedPiAiProviderProfile>> {
    const document = await this.store.snapshot()
    const profiles = new Map<string, ResolvedPiAiProviderProfile>()
    const retryPolicy = resolveRetryPolicy(undefined, 'dsh-auth-everying retryPolicy')
    const add = (route: string, displayName: string, provider: Provider): void => {
      profiles.set(route, {
        provider: route,
        displayName,
        streamIdleTimeoutMs: STREAM_IDLE_TIMEOUT_MS,
        retryPolicy,
        configuredMaxTokens: new Map(),
        piProvider: provider,
      })
    }
    for (const route of Object.values(document.routes)) {
      if (route.enabled.length === 0) continue
      const official = officialByRoute(route.route)
      if (official !== undefined) {
        const runtime = officialRuntimeProvider(official.id, route.baseURL, route.enabled)
        if (runtime !== undefined) add(route.route, route.displayName, runtime)
        continue
      }
      add(route.route, route.displayName, customProvider(route))
    }
    return profiles
  }
}

export function createDshAuthEveryingAdapterSync(
  session: DshAuthEveryingSession,
  resolveAttachments: () => AttachmentStore | undefined,
  cache: { current: Map<string, ResolvedPiAiProviderProfile> },
): PiAiAdapter {
  return new PiAiAdapter({
    profiles: () => cache.current,
    resolveApiKey: async (provider) => session.resolveAccess(provider),
    resolveAttachments,
  })
}

export { authEveryingPath }
