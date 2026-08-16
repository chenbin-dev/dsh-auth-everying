import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bestSecret } from '../src/parse-oauth.ts'
import { fromCcSwitchConfig, isImportable, routeForDiscovered } from '../src/discover.ts'

import { catalogModelIds, customProvider } from '../src/providers.ts'
import { extractModelIds, modelListingUrls } from '../src/live-models.ts'

describe('grok catalog extras', () => {
  it('includes grok-4.6 even when pi-ai has not shipped it', () => {
    expect(catalogModelIds('grok')).toContain('grok-4.6')
  })

  it('reads openai-shaped listings', () => {
    expect(extractModelIds({ data: [{ id: 'grok-4.6' }, { id: 'grok-4.5' }] })).toEqual(['grok-4.6', 'grok-4.5'])
  })
})

describe('routeForDiscovered', () => {
  it('keeps official Claude / Codex / Grok routes', () => {
    expect(routeForDiscovered({
      id: 'live:codex-auth',
      platform: 'codex',
      displayName: 'Codex auth.json',
      origin: 'Codex CLI',
      path: '~/.codex/auth.json',
      kind: 'oauth',
      importable: true,
    })).toBe('codex-oauth')
    expect(routeForDiscovered({
      id: 'keychain:Claude Code-credentials',
      platform: 'claude',
      displayName: 'Claude Code keychain',
      origin: 'macOS Keychain',
      path: 'keychain:Claude Code-credentials',
      kind: 'oauth',
      importable: true,
    })).toBe('claude-oauth')
  })

  it('namespaces CC Switch gateway keys', () => {
    const route = routeForDiscovered({
      id: 'ccswitch:claude:deepseek',
      platform: 'claude',
      displayName: 'DeepSeek (CC Switch)',
      origin: 'CC Switch',
      path: '~/.cc-switch/cc-switch.db',
      kind: 'api_key',
      importable: true,
      baseURL: 'https://api.deepseek.com',
    })
    expect(route.startsWith('auth-everying-')).toBe(true)
    expect(route).toContain('deepseek')
  })
})

describe('CC Switch Codex custom provider', () => {
  it('reads the TOML gateway configuration and Responses wire API', () => {
    const source = fromCcSwitchConfig('provider-id', 'codex', 'team', JSON.stringify({
      auth: { OPENAI_API_KEY: 'test-key' },
      config: [
        'model_provider = "custom"',
        'model = "gpt-5.6-terra"',
        'model_reasoning_effort = "high"',
        '',
        '[model_providers.custom]',
        'base_url = "https://gateway.example"',
        'wire_api = "responses"',
      ].join('\n'),
    }))

    expect(source).toMatchObject({
      id: 'ccswitch:codex:provider-id',
      platform: 'codex',
      baseURL: 'https://gateway.example',
      model: 'gpt-5.6-terra',
      models: ['gpt-5.6-terra'],
      modelReasoningEffort: 'high',
      api: 'openai-responses',
    })
    expect(source !== undefined && isImportable(source)).toBe(true)
  })
})

describe('CC Switch Codex reasoning', () => {
  it('exposes the complete Codex effort selector for the configured model', () => {
    const model = customProvider({
      route: 'everything-team',
      displayName: 'team',
      piProvider: 'everything-team',
      api: 'openai-responses',
      baseURL: 'https://gateway.example',
      models: ['gpt-5.6-terra'],
      enabled: ['gpt-5.6-terra'],
      configuredModel: 'gpt-5.6-terra',
      modelReasoningEffort: 'high',
      sourceId: 'ccswitch:codex:provider-id',
      origin: 'CC Switch',
    }).getModels()[0]
    expect(model).toMatchObject({
      reasoning: true,
      thinkingLevelMap: {
        minimal: 'minimal',
        low: 'low',
        medium: 'medium',
        high: 'high',
        xhigh: 'xhigh',
        max: 'max',
      },
    })
  })

  it('exposes xhigh and max as ultra when the gateway uses the ultra alias', () => {
    const model = customProvider({
      route: 'everything-team',
      displayName: 'team',
      piProvider: 'everything-team',
      api: 'openai-responses',
      baseURL: 'https://gateway.example',
      models: ['gpt-5.6-terra'],
      enabled: ['gpt-5.6-terra'],
      configuredModel: 'gpt-5.6-terra',
      modelReasoningEffort: 'ultra',
      sourceId: 'ccswitch:codex:provider-id',
      origin: 'CC Switch',
    }).getModels()[0]
    expect(model?.thinkingLevelMap).toMatchObject({ high: 'high', xhigh: 'ultra', max: 'ultra' })
  })

  it('exposes extended levels for discovered models too', () => {
    const models = customProvider({
      route: 'everything-team',
      displayName: 'team',
      piProvider: 'everything-team',
      api: 'openai-responses',
      baseURL: 'https://gateway.example',
      models: ['gpt-5.6-terra', 'gpt-5.6-sol'],
      enabled: ['gpt-5.6-terra', 'gpt-5.6-sol'],
      configuredModel: 'gpt-5.6-terra',
      modelReasoningEffort: 'high',
      sourceId: 'ccswitch:codex:provider-id',
      origin: 'CC Switch',
    }).getModels()
    expect(models[1]).toMatchObject({
      id: 'gpt-5.6-sol',
      thinkingLevelMap: { xhigh: 'xhigh', max: 'max' },
    })
  })
})

describe('OpenAI-compatible model-list endpoints', () => {
  it('preserves a configured path prefix and supplies a root fallback', () => {
    expect(modelListingUrls('https://gateway.example')).toEqual([
      'https://gateway.example/v1/models',
      'https://gateway.example/models',
    ])
    expect(modelListingUrls('https://gateway.example/openai/v1')).toEqual([
      'https://gateway.example/openai/v1/models',
    ])
  })
})

describe('claude keychain document', () => {
  it('reads claudeAiOauth', () => {
    const secret = bestSecret({
      claudeAiOauth: {
        accessToken: 'at-test',
        refreshToken: 'rt-test',
        expiresAt: Date.now() + 60_000,
      },
    }, ['claude', 'oauth'])
    expect(secret?.credential.type).toBe('oauth')
  })
})

describe('temp file parse', () => {
  it('reads a fake opencode provider map', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-eo-'))
    const file = join(dir, 'opencode.json')
    await writeFile(file, JSON.stringify({
      provider: {
        zenmux: { options: { apiKey: 'sk-zen', baseURL: 'https://zenmux.example/v1' }, models: { 'glm-4': {} } },
      },
    }))
    const secret = bestSecret(JSON.parse(await (await import('node:fs/promises')).readFile(file, 'utf8')), ['opencode'])
    expect(secret?.credential.type).toBe('api_key')
  })
})
