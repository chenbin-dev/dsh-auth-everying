/**
 * Import local Codex / Claude / Grok / Gemini / Copilot / OpenCode / CC Switch
 * login state into DeepSeek Harness.
 * @module dsh-everything-oauth
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-llm'
import { registerAuthRoutes } from './auth-routes.ts'
import { EverythingOAuthSession, createEverythingAdapterSync } from './session.ts'
import { EverythingOAuthStore } from './store.ts'
import type { AdapterRegistrationHandle } from '@deepseek-ai/dsh-llm'

export const name = 'llm-everything-oauth'
export const inject = ['llm']
export interface Config {}
export const Config: z<Config> = z.object({})

export function apply(ctx: Context, _config: Config): void {
  const cache = { current: new Map() }
  let session!: EverythingOAuthSession
  let adapter!: ReturnType<typeof createEverythingAdapterSync>
  let handle: AdapterRegistrationHandle | undefined
  const reconcile = async (): Promise<void> => {
    cache.current = await session.profiles()
    const routes = [...cache.current.keys()]
    if (handle === undefined && routes.length > 0) {
      handle = ctx.llm.registerAdapter(routes, adapter)
    } else if (handle !== undefined) {
      handle.replace(routes)
    }
    ctx.emit('llm/adapters-updated')
  }
  session = new EverythingOAuthSession(new EverythingOAuthStore(), () => {
    void reconcile()
  })
  adapter = createEverythingAdapterSync(session, () => ctx.get('attachments'), cache)
  ctx.inject(['webServer'], webCtx => registerAuthRoutes(webCtx, session))
  void reconcile()
}

export { discoverSources, publicSource } from './discover.ts'
export { EverythingOAuthSession } from './session.ts'
export { EverythingOAuthStore, everythingOAuthPath } from './store.ts'
export { OFFICIAL_PLATFORMS } from './ids.ts'
export { loginOfficial } from './auth.ts'
