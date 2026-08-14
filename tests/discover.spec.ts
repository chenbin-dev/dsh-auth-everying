import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bestSecret } from '../src/parse-oauth.ts'
import { routeForDiscovered } from '../src/discover.ts'

import { catalogModelIds } from '../src/providers.ts'
import { extractModelIds } from '../src/live-models.ts'

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
    expect(route.startsWith('everything-')).toBe(true)
    expect(route).toContain('deepseek')
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
