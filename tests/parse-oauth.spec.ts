import { describe, expect, it } from 'vitest'
import { bestSecret, collectSecrets } from '../src/parse-oauth.ts'
import { parseDotEnv, parseSimpleToml } from '../src/toml.ts'

describe('collectSecrets', () => {
  it('prefers oauth tokens over a sibling api key', () => {
    const secret = bestSecret({
      tokens: { access_token: 'access-test', refresh_token: 'refresh-test', account_id: 'acct' },
      OPENAI_API_KEY: 'sk-test',
    }, ['codex', 'tokens'])
    expect(secret?.credential.type).toBe('oauth')
    if (secret?.credential.type === 'oauth') {
      expect(secret.credential.access).toBe('access-test')
      expect(secret.credential.accountId).toBe('acct')
    }
  })

  it('reads anthropic env keys', () => {
    const secret = bestSecret({ env: { ANTHROPIC_AUTH_TOKEN: 'sk-ant-test', ANTHROPIC_BASE_URL: 'https://api.example/v1' } }, ['claude'])
    expect(secret?.credential.type).toBe('api_key')
    if (secret?.credential.type === 'api_key') expect(secret.credential.key).toBe('sk-ant-test')
  })

  it('skips mcp headers', () => {
    const found = collectSecrets({
      mcpServers: { zread: { headers: { Authorization: 'Bearer mcp-secret' } } },
      env: { ANTHROPIC_API_KEY: 'sk-real' },
    })
    expect(found.some(item => item.credential.type === 'api_key' && item.credential.type === 'api_key' && item.path.includes('mcp'))).toBe(false)
    expect(found.some(item => item.credential.type === 'api_key' && item.credential.key === 'sk-real')).toBe(true)
  })
})

describe('toml / env', () => {
  it('parses grok-style model tables', () => {
    const data = parseSimpleToml(`
[model.deepseek-v4-pro]
model = "deepseek-v4-pro"
base_url = "https://api.deepseek.com/v1"
api_key = "sk-deepseek-test"
env_key = "DEEPSEEK_API_KEY"
`)
    const model = (data.model as { 'deepseek-v4-pro': { api_key: string; base_url: string } })['deepseek-v4-pro']
    expect(model.api_key).toBe('sk-deepseek-test')
    expect(model.base_url).toBe('https://api.deepseek.com/v1')
  })

  it('parses gemini env files', () => {
    const env = parseDotEnv('GEMINI_API_KEY=abc\n# comment\nGEMINI_MODEL="gemini-2.5-pro"\n')
    expect(env.GEMINI_API_KEY).toBe('abc')
    expect(env.GEMINI_MODEL).toBe('gemini-2.5-pro')
  })
})
