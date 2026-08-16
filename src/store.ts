import { mkdir, readFile, rm, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { Credential, CredentialInfo, CredentialStore } from '@earendil-works/pi-ai'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { STORE_FILENAME, type WireApi } from './ids.ts'

export interface StoredRoute {
  route: string
  displayName: string
  piProvider: string
  api: WireApi
  baseURL?: string
  /** Models this source can offer in Settings. */
  models: string[]
  /** Models the user turned on for the composer picker. */
  enabled: string[]
  /** CC Switch's explicitly configured model, when one is available. */
  configuredModel?: string
  /** CC Switch's configured reasoning effort for configuredModel. */
  modelReasoningEffort?: string
  /** Provider-declared reasoning levels keyed by exact model id. */
  modelReasoningEfforts?: Record<string, string[]>
  sourceId: string
  origin: string
}

interface StoreDocument {
  version: 1
  credentials: Record<string, Credential>
  routes: Record<string, StoredRoute>
}

const EMPTY: StoreDocument = { version: 1, credentials: {}, routes: {} }

function isENOENT(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT'
}

async function assertOwnerOnly(filename: string): Promise<void> {
  let mode: number
  try {
    mode = (await stat(filename)).mode
  } catch (error) {
    if (isENOENT(error)) return
    throw error
  }
  if (process.platform === 'win32') return
  if ((mode & 0o077) !== 0) {
    throw new Error(
      `dsh-auth-everying: ${filename} is readable beyond its owner (mode ${(mode & 0o777).toString(8)}); run chmod 600`,
    )
  }
}

function isCredential(value: unknown): value is Credential {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (record['type'] === 'api_key') return typeof record['key'] === 'string' && record['key'].length > 0
  if (record['type'] !== 'oauth') return false
  return typeof record['access'] === 'string'
    && typeof record['refresh'] === 'string'
    && typeof record['expires'] === 'number'
}

function parseDocument(text: string, filename: string): StoreDocument {
  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch {
    throw new Error(`dsh-auth-everying: ${filename} is not valid JSON`)
  }
  if (typeof value !== 'object' || value === null) throw new Error(`dsh-auth-everying: ${filename} must be an object`)
  const document = value as Record<string, unknown>
  if (document['version'] !== 1) throw new Error(`dsh-auth-everying: unsupported store version`)
  const credentials = isRecord(document['credentials']) ? document['credentials'] : {}
  const routes = isRecord(document['routes']) ? document['routes'] : {}
  const parsedCreds: Record<string, Credential> = {}
  for (const [key, cred] of Object.entries(credentials)) {
    if (isCredential(cred)) parsedCreds[key] = structuredClone(cred)
  }
  const parsedRoutes: Record<string, StoredRoute> = {}
  for (const [key, route] of Object.entries(routes)) {
    if (!isRecord(route) || typeof route['route'] !== 'string') continue
    parsedRoutes[key] = {
      route: route['route'],
      displayName: typeof route['displayName'] === 'string' ? route['displayName'] : key,
      piProvider: typeof route['piProvider'] === 'string' ? route['piProvider'] : key,
      api: route['api'] === 'anthropic-messages' || route['api'] === 'openai-responses' || route['api'] === 'openai-codex-responses'
        ? route['api']
        : 'openai-completions',
      models: Array.isArray(route['models']) ? route['models'].filter((id): id is string => typeof id === 'string') : [],
      enabled: Array.isArray(route['enabled'])
        ? route['enabled'].filter((id): id is string => typeof id === 'string')
        : [],
      ...typeof route['configuredModel'] === 'string' && route['configuredModel'].length > 0
        ? { configuredModel: route['configuredModel'] }
        : {},
      ...typeof route['modelReasoningEffort'] === 'string' && route['modelReasoningEffort'].length > 0
        ? { modelReasoningEffort: route['modelReasoningEffort'] }
        : {},
      ...isRecord(route['modelReasoningEfforts'])
        ? {
            modelReasoningEfforts: Object.fromEntries(Object.entries(route['modelReasoningEfforts']).flatMap(([id, efforts]) => {
              if (!Array.isArray(efforts)) return []
              const values = efforts.filter((effort): effort is string => typeof effort === 'string' && effort.length > 0)
              return [[id, [...new Set(values)]]]
            })),
          }
        : {},
      sourceId: typeof route['sourceId'] === 'string' ? route['sourceId'] : key,
      origin: typeof route['origin'] === 'string' ? route['origin'] : 'imported',
      ...typeof route['baseURL'] === 'string' ? { baseURL: route['baseURL'] } : {},
    }
  }
  return { version: 1, credentials: parsedCreds, routes: parsedRoutes }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function authEveryingPath(dshHome?: string): string {
  return resolve(join(resolveDshHome(dshHome), STORE_FILENAME))
}

export class DshAuthEveryingStore implements CredentialStore {
  readonly filename: string

  constructor(filename: string = authEveryingPath()) {
    this.filename = resolve(filename)
  }

  private async readDocument(): Promise<StoreDocument> {
    await assertOwnerOnly(this.filename)
    try {
      return parseDocument(await readFile(this.filename, 'utf8'), this.filename)
    } catch (error) {
      if (isENOENT(error)) return structuredClone(EMPTY)
      throw error
    }
  }

  private async writeDocument(document: StoreDocument): Promise<void> {
    await mkdir(dirname(this.filename), { recursive: true, mode: 0o700 })
    await writeFileAtomic(this.filename, `${JSON.stringify(document, null, 2)}\n`, {
      mode: 0o600,
      dirMode: 0o700,
    })
  }

  async snapshot(): Promise<StoreDocument> {
    return this.readDocument()
  }

  async read(providerId: string): Promise<Credential | undefined> {
    const document = await this.readDocument()
    const credential = document.credentials[providerId]
    return credential === undefined ? undefined : structuredClone(credential)
  }

  async list(): Promise<readonly CredentialInfo[]> {
    const document = await this.readDocument()
    return Object.entries(document.credentials).map(([providerId, credential]) => ({
      providerId,
      type: credential.type,
    }))
  }

  async modify(
    providerId: string,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
  ): Promise<Credential | undefined> {
    await mkdir(dirname(this.filename), { recursive: true, mode: 0o700 })
    return withFileLock(this.filename, async () => {
      const document = await this.readDocument()
      const next = await fn(document.credentials[providerId] === undefined
        ? undefined
        : structuredClone(document.credentials[providerId]))
      if (next === undefined) return document.credentials[providerId]
      document.credentials[providerId] = structuredClone(next)
      await this.writeDocument(document)
      return structuredClone(next)
    })
  }

  async delete(providerId: string): Promise<void> {
    await mkdir(dirname(this.filename), { recursive: true, mode: 0o700 })
    await withFileLock(this.filename, async () => {
      const document = await this.readDocument()
      delete document.credentials[providerId]
      delete document.routes[providerId]
      for (const [key, route] of Object.entries(document.routes)) {
        if (route.route !== providerId && route.piProvider !== providerId) continue
        delete document.routes[key]
        delete document.credentials[route.route]
        delete document.credentials[route.piProvider]
      }
      if (Object.keys(document.credentials).length === 0 && Object.keys(document.routes).length === 0) {
        await rm(this.filename, { force: true })
        return
      }
      await this.writeDocument(document)
    })
  }

  async patchRoute(routeId: string, patch: Partial<StoredRoute>): Promise<StoredRoute | undefined> {
    await mkdir(dirname(this.filename), { recursive: true, mode: 0o700 })
    return withFileLock(this.filename, async () => {
      const document = await this.readDocument()
      const current = document.routes[routeId]
      if (current === undefined) return undefined
      const next = { ...current, ...patch, route: current.route }
      document.routes[routeId] = next
      await this.writeDocument(document)
      return structuredClone(next)
    })
  }

  async putRoute(route: StoredRoute, credential: Credential): Promise<void> {
    await mkdir(dirname(this.filename), { recursive: true, mode: 0o700 })
    await withFileLock(this.filename, async () => {
      const document = await this.readDocument()
      document.routes[route.route] = route
      document.credentials[route.piProvider] = structuredClone(credential)
      if (route.route !== route.piProvider) {
        document.credentials[route.route] = structuredClone(credential)
      }
      await this.writeDocument(document)
    })
  }

  async clearAll(): Promise<void> {
    await mkdir(dirname(this.filename), { recursive: true, mode: 0o700 })
    await withFileLock(this.filename, () => rm(this.filename, { force: true }))
  }
}
