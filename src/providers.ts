import { createProvider, type Api, type Model, type Provider, type ThinkingLevelMap } from '@earendil-works/pi-ai'
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic'
import { githubCopilotProvider } from '@earendil-works/pi-ai/providers/github-copilot'
import { googleProvider } from '@earendil-works/pi-ai/providers/google'
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'
import { xaiProvider } from '@earendil-works/pi-ai/providers/xai'
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy'
import {
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_TOKENS,
  EXTRA_CATALOG_MODELS,
  type OfficialPlatformId,
  type WireApi,
  officialById,
} from './ids.ts'
import type { StoredRoute } from './store.ts'

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
const THINKING_LEVELS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const
type ThinkingLevel = typeof THINKING_LEVELS[number]

function bearerOf(credential: { type?: string; key?: string; access?: string } | undefined): string | undefined {
  if (credential === undefined) return undefined
  if (typeof credential.access === 'string' && credential.access.length > 0) return credential.access
  if (typeof credential.key === 'string' && credential.key.length > 0) return credential.key
  return undefined
}

export function requestProvider(provider: Provider, baseURL?: string): Provider {
  return {
    ...provider,
    ...baseURL === undefined ? {} : { baseUrl: baseURL },
    auth: {
      ...provider.auth,
      apiKey: {
        name: `${provider.name} imported credential`,
        async resolve({ credential }) {
          const apiKey = bearerOf(credential)
          if (apiKey === undefined) return undefined
          return {
            auth: {
              apiKey,
              ...baseURL === undefined ? {} : { baseUrl: baseURL },
            },
            source: 'imported',
          }
        },
      },
    },
  }
}

export function catalogProvider(id: OfficialPlatformId): Provider | undefined {
  switch (id) {
    case 'claude':
      return anthropicProvider()
    case 'codex':
      return openaiCodexProvider()
    case 'grok':
      return xaiProvider()
    case 'gemini':
      return googleProvider()
    case 'copilot':
      return githubCopilotProvider()
    case 'opencode':
      return undefined
  }
}

/** Mirror CC Switch's configured effort for its selected model without guessing other models' capabilities. */
function configuredReasoning(route: StoredRoute, id: string): Pick<Model<WireApi>, 'reasoning' | 'thinkingLevelMap'> {
  if (route.configuredModel !== id || route.modelReasoningEffort === undefined) return { reasoning: true }
  const effort = route.modelReasoningEffort.trim().toLowerCase()
  if (effort === 'off' || effort === 'none' || effort === 'disabled') return { reasoning: false }
  const level: ThinkingLevel | undefined = effort === 'ultra'
    ? 'xhigh'
    : THINKING_LEVELS.includes(effort as ThinkingLevel)
      ? effort as ThinkingLevel
      : undefined
  if (level === undefined) return { reasoning: true }
  const thinkingLevelMap: ThinkingLevelMap = { off: null }
  for (const candidate of THINKING_LEVELS) thinkingLevelMap[candidate] = candidate === level ? effort : null
  return { reasoning: true, thinkingLevelMap }
}

function materializeModel(route: StoredRoute, id: string): Model<WireApi> {
  return {
    id,
    name: id,
    api: route.api,
    provider: route.route,
    baseUrl: route.baseURL ?? 'https://example.invalid/v1',
    ...configuredReasoning(route, id),
    input: ['text', 'image'],
    cost: ZERO_COST,
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MAX_TOKENS,
  }
}

export function visibleModelIds(route: StoredRoute): string[] {
  return route.enabled.filter(id => id.length > 0)
}

export function customProvider(route: StoredRoute): Provider {
  const ids = visibleModelIds(route)
  const models = (ids.length > 0 ? ids : []).map(id => materializeModel(route, id))
  const api = route.api === 'anthropic-messages'
    ? anthropicMessagesApi()
    : route.api === 'openai-responses' || route.api === 'openai-codex-responses'
      ? openAIResponsesApi()
      : openAICompletionsApi()
  return requestProvider(createProvider({
    id: route.route,
    name: route.displayName,
    baseUrl: route.baseURL,
    auth: {
      apiKey: {
        name: `${route.displayName} key`,
        async resolve({ credential }) {
          const apiKey = bearerOf(credential)
          return apiKey === undefined
            ? undefined
            : { auth: { apiKey, ...route.baseURL === undefined ? {} : { baseUrl: route.baseURL } }, source: 'imported' }
        },
      },
    },
    models,
    api,
  }), route.baseURL)
}

export function officialRuntimeProvider(
  id: OfficialPlatformId,
  baseURL?: string,
  enabled: readonly string[] = [],
): Provider | undefined {
  const catalog = catalogProvider(id)
  if (catalog === undefined) return undefined
  const official = officialById(id)
  if (official === undefined) return catalog
  const catalogModels = catalog.getModels().map(model => ({ ...model, provider: official.route }))
  const byId = new Map(catalogModels.map(model => [model.id, model]))
  const models = enabled.flatMap(modelId => {
    const existing = byId.get(modelId)
    if (existing !== undefined) return [existing]
    const template = templateForExtra(id, modelId, catalogModels)
    if (template === undefined) return []
    return [{ ...template, id: modelId, name: titleCaseId(modelId), provider: official.route }]
  })
  return {
    ...requestProvider(catalog, baseURL),
    id: official.route,
    name: official.displayName,
    getModels: () => models,
  }
}

export function catalogModelIds(id: OfficialPlatformId): string[] {
  const shipped = catalogProvider(id)?.getModels().map(model => model.id) ?? []
  return [...new Set([...shipped, ...(EXTRA_CATALOG_MODELS[id] ?? [])])]
}

function titleCaseId(id: string): string {
  return id
    .split(/[-_]/g)
    .map(part => part.length === 0 ? part : part[0]!.toUpperCase() + part.slice(1))
    .join(' ')
}

function templateForExtra(
  platform: OfficialPlatformId,
  modelId: string,
  catalog: readonly Model<Api>[],
): Model<Api> | undefined {
  if (platform === 'grok' && (modelId === 'grok-4.6' || modelId.startsWith('grok-4.6'))) {
    return catalog.find(model => model.id === 'grok-4.5') ?? catalog.find(model => model.api === 'openai-responses') ?? catalog[0]
  }
  return catalog[0]
}
