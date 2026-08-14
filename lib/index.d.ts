import z from "@deepseek-ai/schemastery";
import { AuthInteraction, Credential, CredentialInfo, CredentialStore, MutableModels } from "@earendil-works/pi-ai";
import { PiAiAdapter, ResolvedPiAiProviderProfile } from "@deepseek-ai/dsh-llm-pi-ai";
import { Context } from "@deepseek-ai/cordis";
import "@deepseek-ai/dsh-attachment";
//#region src/ids.d.ts
type OfficialPlatformId = 'claude' | 'codex' | 'grok' | 'gemini' | 'copilot' | 'opencode';
type WireApi = 'anthropic-messages' | 'openai-completions' | 'openai-responses' | 'openai-codex-responses';
interface OfficialPlatform {
  id: OfficialPlatformId;
  route: string;
  piProvider: string;
  displayName: string;
  defaultModel: string;
  canLogin: boolean;
  liveModelsUrl?: string;
}
declare const OFFICIAL_PLATFORMS: readonly OfficialPlatform[];
//#endregion
//#region src/discover.d.ts
type SourceKind = 'oauth' | 'api_key';
interface DiscoveredSource {
  id: string;
  platform: OfficialPlatformId | 'custom';
  displayName: string;
  origin: string;
  path: string;
  kind: SourceKind;
  importable: boolean;
  baseURL?: string;
  baseHost?: string;
  model?: string;
  models?: string[];
  api?: WireApi;
  envKey?: string;
}
interface ImportableSource extends DiscoveredSource {
  credential: Credential;
}
declare function publicSource(item: DiscoveredSource | ImportableSource): DiscoveredSource;
/** Scan CC Switch + live coding-tool configs. Secrets stay on ImportableSource only. */
declare function discoverSources(): Promise<Array<ImportableSource | DiscoveredSource>>;
//#endregion
//#region src/store.d.ts
interface StoredRoute {
  route: string;
  displayName: string;
  piProvider: string;
  api: WireApi;
  baseURL?: string;
  /** Models this source can offer in Settings. */
  models: string[];
  /** Models the user turned on for the composer picker. */
  enabled: string[];
  sourceId: string;
  origin: string;
}
interface StoreDocument {
  version: 1;
  credentials: Record<string, Credential>;
  routes: Record<string, StoredRoute>;
}
declare function everythingOAuthPath(dshHome?: string): string;
declare class EverythingOAuthStore implements CredentialStore {
  readonly filename: string;
  constructor(filename?: string);
  private readDocument;
  private writeDocument;
  snapshot(): Promise<StoreDocument>;
  read(providerId: string): Promise<Credential | undefined>;
  list(): Promise<readonly CredentialInfo[]>;
  modify(providerId: string, fn: (current: Credential | undefined) => Promise<Credential | undefined>): Promise<Credential | undefined>;
  delete(providerId: string): Promise<void>;
  patchRoute(routeId: string, patch: Partial<StoredRoute>): Promise<StoredRoute | undefined>;
  putRoute(route: StoredRoute, credential: Credential): Promise<void>;
  clearAll(): Promise<void>;
}
//#endregion
//#region src/session.d.ts
interface PlatformStatus {
  id: string;
  route: string;
  displayName: string;
  signedIn: boolean;
  canLogin: boolean;
  kind?: 'oauth' | 'api_key';
  origin?: string;
  sourceId?: string;
  available: string[];
  enabled: string[];
}
declare class EverythingOAuthSession {
  readonly store: EverythingOAuthStore;
  readonly models: MutableModels;
  private onChange;
  constructor(store?: EverythingOAuthStore, onChange?: () => void);
  discover(): Promise<DiscoveredSource[]>;
  importOne(id: string): Promise<DiscoveredSource>;
  importMany(ids: readonly string[]): Promise<DiscoveredSource[]>;
  importAll(): Promise<DiscoveredSource[]>;
  private defaultEnabled;
  private persist;
  setEnabled(routeId: string, enabled: readonly string[]): Promise<void>;
  status(): Promise<{
    platforms: PlatformStatus[];
    discovered: Array<DiscoveredSource & {
      imported: boolean;
    }>;
  }>;
  logout(id?: string): Promise<void>;
  resolveAccess(route: string): Promise<string>;
  profiles(): Promise<Map<string, ResolvedPiAiProviderProfile>>;
}
//#endregion
//#region src/auth.d.ts
declare function loginOfficial(id: OfficialPlatformId, interaction: AuthInteraction, store?: EverythingOAuthStore): Promise<void>;
//#endregion
//#region src/index.d.ts
declare const name = "llm-everything-oauth";
declare const inject: string[];
interface Config {}
declare const Config: z<Config>;
declare function apply(ctx: Context, _config: Config): void;
//#endregion
export { Config, EverythingOAuthSession, EverythingOAuthStore, OFFICIAL_PLATFORMS, apply, discoverSources, everythingOAuthPath, inject, loginOfficial, name, publicSource };