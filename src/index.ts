/**
 * Import local Codex / Claude / Grok / Gemini / Copilot / OpenCode / CC Switch
 * login state into DeepSeek Harness.
 * @module dsh-auth-everying
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-llm'
import { registerAuthRoutes } from './auth-routes.ts'
import { DshAuthEveryingSession, createDshAuthEveryingAdapterSync } from './session.ts'
import { DshAuthEveryingStore } from './store.ts'
import type { AdapterRegistrationHandle } from '@deepseek-ai/dsh-llm'

export const name = 'llm-dsh-auth-everying'
export const inject = ['llm']
export interface Config {}
export const Config: z<Config> = z.object({})

export function apply(ctx: Context, _config: Config): void {
  const cache: Parameters<typeof createDshAuthEveryingAdapterSync>[2] = {
    current: new Map(),
    ultra: new Map(),
    ultraRoutes: new Set<string>(),
  }
  let session!: DshAuthEveryingSession
  let adapter!: ReturnType<typeof createDshAuthEveryingAdapterSync>
  let handle: AdapterRegistrationHandle | undefined
  const reconcile = async (): Promise<void> => {
    cache.current = await session.profiles()
    cache.ultra = await session.profiles('ultra')
    cache.ultraRoutes = await session.ultraRoutes()
    const routes = [...cache.current.keys()]
    if (handle === undefined && routes.length > 0) {
      handle = ctx.llm.registerAdapter(routes, adapter)
    } else if (handle !== undefined) {
      handle.replace(routes)
    }
    ctx.emit('llm/adapters-updated')
  }
  session = new DshAuthEveryingSession(new DshAuthEveryingStore(), () => {
    void reconcile()
  })
  adapter = createDshAuthEveryingAdapterSync(session, () => ctx.get('attachments'), cache)
  ctx.inject(['webServer'], webCtx => registerAuthRoutes(webCtx, session))
  void reconcile()
}

export { discoverSources, publicSource } from './discover.ts'
export { DshAuthEveryingSession } from './session.ts'
export { DshAuthEveryingStore, authEveryingPath } from './store.ts'
export { OFFICIAL_PLATFORMS } from './ids.ts'
export { loginOfficial } from './auth.ts'
