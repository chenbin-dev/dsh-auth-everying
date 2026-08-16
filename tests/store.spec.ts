import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DshAuthEveryingStore } from '../src/store.ts'

describe('DshAuthEveryingStore', () => {
  it('round-trips oauth and api key credentials', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-eo-store-'))
    const store = new DshAuthEveryingStore(join(dir, 'auth.json'))
    await store.putRoute({
      route: 'codex-oauth',
      displayName: 'Codex',
      piProvider: 'openai-codex',
      api: 'openai-codex-responses',
      models: ['gpt-5.4'],
      enabled: ['gpt-5.4'],
      sourceId: 'live:codex-auth',
      origin: 'Codex CLI',
    }, { type: 'oauth', access: 'a', refresh: 'r', expires: Date.now() + 1000, accountId: 'acct' })
    const read = await store.read('openai-codex')
    expect(read?.type).toBe('oauth')
    const snap = await store.snapshot()
    expect(snap.routes['codex-oauth']?.origin).toBe('Codex CLI')
    await store.delete('openai-codex')
    expect(await store.read('openai-codex')).toBeUndefined()
  })
})
