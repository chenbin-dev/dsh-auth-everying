import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AuthEvent, AuthPrompt } from '@earendil-works/pi-ai'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import {
  AUTH_IMPORT_ALL_PATH,
  AUTH_IMPORT_PATH,
  AUTH_LOGIN_PATH,
  AUTH_LOGOUT_PATH,
  AUTH_MODELS_PATH,
  AUTH_STATUS_PATH,
  officialById,
  type OfficialPlatformId,
} from './ids.ts'
import { loginSession } from './auth.ts'
import { safeMessage } from './redact.ts'
import type { EverythingOAuthSession } from './session.ts'

interface LoginChallenge {
  url: string
  userCode?: string
}

function waitForPromptAbort(prompt: AuthPrompt): Promise<string> {
  const signal = prompt.signal
  if (signal === undefined) return new Promise<string>(() => {})
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise<string>((_resolve, reject) => {
    signal.addEventListener('abort', () => { reject(signal.reason) }, { once: true })
  })
}

function trustedRequest(req: IncomingMessage): boolean {
  const remote = req.socket.remoteAddress
  if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const host = req.headers.host
  if (host === undefined) return false
  const origin = req.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === new URL(`http://${host}`).host
  } catch {
    return false
  }
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (text.length === 0) return {}
  const value: unknown = JSON.parse(text)
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(value))
}

class LoginRunner {
  private operation: Promise<void> | undefined
  private challenge: LoginChallenge | undefined
  private waiters: Array<{ resolve(value: LoginChallenge): void; reject(error: unknown): void }> = []

  constructor(private readonly session: EverythingOAuthSession) {}

  async start(id: OfficialPlatformId): Promise<LoginChallenge> {
    if (this.operation !== undefined && this.challenge !== undefined) return this.challenge
    const cancellation = new AbortController()
    this.challenge = undefined
    this.operation = loginSession(this.session, id, {
      signal: cancellation.signal,
      prompt: prompt => prompt.type === 'select'
        ? Promise.resolve(prompt.options.find(option => option.id.includes('oauth'))?.id ?? prompt.options[0]?.id ?? 'oauth')
        : waitForPromptAbort(prompt),
      notify: event => this.onEvent(event),
    }).catch((error: unknown) => {
      for (const waiter of this.waiters.splice(0)) waiter.reject(error)
      throw error
    }).finally(() => {
      this.operation = undefined
    })
    if (this.challenge !== undefined) return this.challenge
    return new Promise<LoginChallenge>((resolve, reject) => {
      this.waiters.push({ resolve, reject })
    })
  }

  private onEvent(event: AuthEvent): void {
    if (event.type === 'device_code') {
      this.accept({
        url: event.verificationUri,
        ...event.userCode.length > 0 ? { userCode: event.userCode } : {},
      })
      return
    }
    if (event.type === 'auth_url') this.accept({ url: event.url })
  }

  private accept(challenge: LoginChallenge): void {
    try {
      if (new URL(challenge.url).protocol !== 'https:') throw new Error('unsafe url')
    } catch {
      const error = new Error('provider returned an unsafe authorization URL')
      for (const waiter of this.waiters.splice(0)) waiter.reject(error)
      return
    }
    this.challenge = challenge
    for (const waiter of this.waiters.splice(0)) waiter.resolve(challenge)
  }
}

export function registerAuthRoutes(ctx: Context, session: EverythingOAuthSession): void {
  const logins = new LoginRunner(session)
  ctx.effect(() => {
    const routes = [
      ctx.webServer.register({
        kind: 'exact',
        path: AUTH_STATUS_PATH,
        handler: async (req, res) => {
          if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' })
          if (!trustedRequest(req)) return json(res, 403, { error: 'forbidden' })
          json(res, 200, await session.status())
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: AUTH_IMPORT_ALL_PATH,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
          if (!trustedRequest(req)) return json(res, 403, { error: 'forbidden' })
          try {
            const imported = await session.importAll()
            json(res, 200, { imported, ...await session.status() })
          } catch (error: unknown) {
            json(res, 500, { error: safeMessage(error) })
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: AUTH_IMPORT_PATH,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
          if (!trustedRequest(req)) return json(res, 403, { error: 'forbidden' })
          try {
            const body = await readJson(req)
            const ids = Array.isArray(body['ids'])
              ? body['ids'].filter((id): id is string => typeof id === 'string')
              : typeof body['id'] === 'string'
                ? [body['id']]
                : []
            if (ids.length === 0) return json(res, 400, { error: 'select at least one source' })
            await session.importMany(ids)
            json(res, 200, await session.status())
          } catch (error: unknown) {
            json(res, 500, { error: safeMessage(error) })
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: AUTH_MODELS_PATH,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
          if (!trustedRequest(req)) return json(res, 403, { error: 'forbidden' })
          try {
            const body = await readJson(req)
            const route = typeof body['route'] === 'string' ? body['route'] : undefined
            const enabled = Array.isArray(body['enabled'])
              ? body['enabled'].filter((id): id is string => typeof id === 'string')
              : undefined
            if (route === undefined || enabled === undefined) {
              return json(res, 400, { error: 'route and enabled[] are required' })
            }
            await session.setEnabled(route, enabled)
            json(res, 200, await session.status())
          } catch (error: unknown) {
            json(res, 500, { error: safeMessage(error) })
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: AUTH_LOGIN_PATH,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
          if (!trustedRequest(req)) return json(res, 403, { error: 'forbidden' })
          try {
            const body = await readJson(req)
            const id = typeof body['id'] === 'string' ? body['id'] : undefined
            const platform = id === undefined ? undefined : officialById(id)
            if (platform === undefined || !platform.canLogin) {
              return json(res, 400, { error: 'platform does not support OAuth login' })
            }
            json(res, 200, await logins.start(platform.id))
          } catch (error: unknown) {
            json(res, 500, { error: safeMessage(error) })
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: AUTH_LOGOUT_PATH,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
          if (!trustedRequest(req)) return json(res, 403, { error: 'forbidden' })
          const body = await readJson(req)
          await session.logout(typeof body['id'] === 'string' ? body['id'] : undefined)
          json(res, 200, { ok: true, ...await session.status() })
        },
      }),
    ]
    return () => {
      for (const dispose of routes) dispose()
    }
  }, 'dsh-everything-oauth: web routes')
}
