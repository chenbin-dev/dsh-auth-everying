import { _ as officialById, a as AUTH_IMPORT_ALL_PATH, b as slugify, c as AUTH_LOGOUT_PATH, d as DEFAULT_CONTEXT_WINDOW, f as DEFAULT_MAX_TOKENS, g as STREAM_IDLE_TIMEOUT_MS, h as STORE_FILENAME, i as parseJsonDocument, l as AUTH_MODELS_PATH, m as OFFICIAL_PLATFORMS, n as isRecord$1, o as AUTH_IMPORT_PATH, p as EXTRA_CATALOG_MODELS, r as nonEmptyString, s as AUTH_LOGIN_PATH, t as bestSecret, u as AUTH_STATUS_PATH, v as officialByPi, y as officialByRoute } from "./parse-oauth-lUn93a9W.js";
import z from "@deepseek-ai/schemastery";
import { createModels, createProvider } from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import { githubCopilotProvider } from "@earendil-works/pi-ai/providers/github-copilot";
import { googleProvider } from "@earendil-works/pi-ai/providers/google";
import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";
import { xaiProvider } from "@earendil-works/pi-ai/providers/xai";
import { anthropicMessagesApi } from "@earendil-works/pi-ai/api/anthropic-messages.lazy";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { openAIResponsesApi } from "@earendil-works/pi-ai/api/openai-responses.lazy";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { LlmError, resolveRetryPolicy } from "@deepseek-ai/dsh-llm";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
//#region src/providers.ts
const ZERO_COST = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0
};
function bearerOf(credential) {
	if (credential === void 0) return void 0;
	if (typeof credential.access === "string" && credential.access.length > 0) return credential.access;
	if (typeof credential.key === "string" && credential.key.length > 0) return credential.key;
}
function requestProvider(provider, baseURL) {
	return {
		...provider,
		...baseURL === void 0 ? {} : { baseUrl: baseURL },
		auth: {
			...provider.auth,
			apiKey: {
				name: `${provider.name} imported credential`,
				async resolve({ credential }) {
					const apiKey = bearerOf(credential);
					if (apiKey === void 0) return void 0;
					return {
						auth: {
							apiKey,
							...baseURL === void 0 ? {} : { baseUrl: baseURL }
						},
						source: "imported"
					};
				}
			}
		}
	};
}
function catalogProvider(id) {
	switch (id) {
		case "claude": return anthropicProvider();
		case "codex": return openaiCodexProvider();
		case "grok": return xaiProvider();
		case "gemini": return googleProvider();
		case "copilot": return githubCopilotProvider();
		case "opencode": return;
	}
}
function materializeModel(route, id) {
	return {
		id,
		name: id,
		api: route.api,
		provider: route.route,
		baseUrl: route.baseURL ?? "https://example.invalid/v1",
		reasoning: true,
		input: ["text", "image"],
		cost: ZERO_COST,
		contextWindow: DEFAULT_CONTEXT_WINDOW,
		maxTokens: DEFAULT_MAX_TOKENS
	};
}
function visibleModelIds(route) {
	return route.enabled.filter((id) => id.length > 0);
}
function customProvider(route) {
	const ids = visibleModelIds(route);
	const models = (ids.length > 0 ? ids : []).map((id) => materializeModel(route, id));
	const api = route.api === "anthropic-messages" ? anthropicMessagesApi() : route.api === "openai-responses" || route.api === "openai-codex-responses" ? openAIResponsesApi() : openAICompletionsApi();
	return requestProvider(createProvider({
		id: route.route,
		name: route.displayName,
		baseUrl: route.baseURL,
		auth: { apiKey: {
			name: `${route.displayName} key`,
			async resolve({ credential }) {
				const apiKey = bearerOf(credential);
				return apiKey === void 0 ? void 0 : {
					auth: {
						apiKey,
						...route.baseURL === void 0 ? {} : { baseUrl: route.baseURL }
					},
					source: "imported"
				};
			}
		} },
		models,
		api
	}), route.baseURL);
}
function officialRuntimeProvider(id, baseURL, enabled = []) {
	const catalog = catalogProvider(id);
	if (catalog === void 0) return void 0;
	const official = officialById(id);
	if (official === void 0) return catalog;
	const catalogModels = catalog.getModels().map((model) => ({
		...model,
		provider: official.route
	}));
	const byId = new Map(catalogModels.map((model) => [model.id, model]));
	const models = enabled.flatMap((modelId) => {
		const existing = byId.get(modelId);
		if (existing !== void 0) return [existing];
		const template = templateForExtra(id, modelId, catalogModels);
		if (template === void 0) return [];
		return [{
			...template,
			id: modelId,
			name: titleCaseId(modelId),
			provider: official.route
		}];
	});
	return {
		...requestProvider(catalog, baseURL),
		id: official.route,
		name: official.displayName,
		getModels: () => models
	};
}
function catalogModelIds(id) {
	const shipped = catalogProvider(id)?.getModels().map((model) => model.id) ?? [];
	return [.../* @__PURE__ */ new Set([...shipped, ...EXTRA_CATALOG_MODELS[id] ?? []])];
}
function titleCaseId(id) {
	return id.split(/[-_]/g).map((part) => part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)).join(" ");
}
function templateForExtra(platform, modelId, catalog) {
	if (platform === "grok" && (modelId === "grok-4.6" || modelId.startsWith("grok-4.6"))) return catalog.find((model) => model.id === "grok-4.5") ?? catalog.find((model) => model.api === "openai-responses") ?? catalog[0];
	return catalog[0];
}
//#endregion
//#region src/store.ts
const EMPTY = {
	version: 1,
	credentials: {},
	routes: {}
};
function isENOENT(error) {
	return error?.code === "ENOENT";
}
async function assertOwnerOnly(filename) {
	let mode;
	try {
		mode = (await stat(filename)).mode;
	} catch (error) {
		if (isENOENT(error)) return;
		throw error;
	}
	if (process.platform === "win32") return;
	if ((mode & 63) !== 0) throw new Error(`everything-oauth: ${filename} is readable beyond its owner (mode ${(mode & 511).toString(8)}); run chmod 600`);
}
function isCredential(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	if (record["type"] === "api_key") return typeof record["key"] === "string" && record["key"].length > 0;
	if (record["type"] !== "oauth") return false;
	return typeof record["access"] === "string" && typeof record["refresh"] === "string" && typeof record["expires"] === "number";
}
function parseDocument(text, filename) {
	let value;
	try {
		value = JSON.parse(text);
	} catch {
		throw new Error(`everything-oauth: ${filename} is not valid JSON`);
	}
	if (typeof value !== "object" || value === null) throw new Error(`everything-oauth: ${filename} must be an object`);
	const document = value;
	if (document["version"] !== 1) throw new Error(`everything-oauth: unsupported store version`);
	const credentials = isRecord(document["credentials"]) ? document["credentials"] : {};
	const routes = isRecord(document["routes"]) ? document["routes"] : {};
	const parsedCreds = {};
	for (const [key, cred] of Object.entries(credentials)) if (isCredential(cred)) parsedCreds[key] = structuredClone(cred);
	const parsedRoutes = {};
	for (const [key, route] of Object.entries(routes)) {
		if (!isRecord(route) || typeof route["route"] !== "string") continue;
		parsedRoutes[key] = {
			route: route["route"],
			displayName: typeof route["displayName"] === "string" ? route["displayName"] : key,
			piProvider: typeof route["piProvider"] === "string" ? route["piProvider"] : key,
			api: route["api"] === "anthropic-messages" || route["api"] === "openai-responses" || route["api"] === "openai-codex-responses" ? route["api"] : "openai-completions",
			models: Array.isArray(route["models"]) ? route["models"].filter((id) => typeof id === "string") : [],
			enabled: Array.isArray(route["enabled"]) ? route["enabled"].filter((id) => typeof id === "string") : [],
			sourceId: typeof route["sourceId"] === "string" ? route["sourceId"] : key,
			origin: typeof route["origin"] === "string" ? route["origin"] : "imported",
			...typeof route["baseURL"] === "string" ? { baseURL: route["baseURL"] } : {}
		};
	}
	return {
		version: 1,
		credentials: parsedCreds,
		routes: parsedRoutes
	};
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function everythingOAuthPath(dshHome) {
	return resolve(join(resolveDshHome(dshHome), STORE_FILENAME));
}
var EverythingOAuthStore = class {
	filename;
	constructor(filename = everythingOAuthPath()) {
		this.filename = resolve(filename);
	}
	async readDocument() {
		await assertOwnerOnly(this.filename);
		try {
			return parseDocument(await readFile(this.filename, "utf8"), this.filename);
		} catch (error) {
			if (isENOENT(error)) return structuredClone(EMPTY);
			throw error;
		}
	}
	async writeDocument(document) {
		await mkdir(dirname(this.filename), {
			recursive: true,
			mode: 448
		});
		await writeFileAtomic(this.filename, `${JSON.stringify(document, null, 2)}\n`, {
			mode: 384,
			dirMode: 448
		});
	}
	async snapshot() {
		return this.readDocument();
	}
	async read(providerId) {
		const credential = (await this.readDocument()).credentials[providerId];
		return credential === void 0 ? void 0 : structuredClone(credential);
	}
	async list() {
		const document = await this.readDocument();
		return Object.entries(document.credentials).map(([providerId, credential]) => ({
			providerId,
			type: credential.type
		}));
	}
	async modify(providerId, fn) {
		await mkdir(dirname(this.filename), {
			recursive: true,
			mode: 448
		});
		return withFileLock(this.filename, async () => {
			const document = await this.readDocument();
			const next = await fn(document.credentials[providerId] === void 0 ? void 0 : structuredClone(document.credentials[providerId]));
			if (next === void 0) return document.credentials[providerId];
			document.credentials[providerId] = structuredClone(next);
			await this.writeDocument(document);
			return structuredClone(next);
		});
	}
	async delete(providerId) {
		await mkdir(dirname(this.filename), {
			recursive: true,
			mode: 448
		});
		await withFileLock(this.filename, async () => {
			const document = await this.readDocument();
			delete document.credentials[providerId];
			delete document.routes[providerId];
			for (const [key, route] of Object.entries(document.routes)) {
				if (route.route !== providerId && route.piProvider !== providerId) continue;
				delete document.routes[key];
				delete document.credentials[route.route];
				delete document.credentials[route.piProvider];
			}
			if (Object.keys(document.credentials).length === 0 && Object.keys(document.routes).length === 0) {
				await rm(this.filename, { force: true });
				return;
			}
			await this.writeDocument(document);
		});
	}
	async patchRoute(routeId, patch) {
		await mkdir(dirname(this.filename), {
			recursive: true,
			mode: 448
		});
		return withFileLock(this.filename, async () => {
			const document = await this.readDocument();
			const current = document.routes[routeId];
			if (current === void 0) return void 0;
			const next = {
				...current,
				...patch,
				route: current.route
			};
			document.routes[routeId] = next;
			await this.writeDocument(document);
			return structuredClone(next);
		});
	}
	async putRoute(route, credential) {
		await mkdir(dirname(this.filename), {
			recursive: true,
			mode: 448
		});
		await withFileLock(this.filename, async () => {
			const document = await this.readDocument();
			document.routes[route.route] = route;
			document.credentials[route.piProvider] = structuredClone(credential);
			if (route.route !== route.piProvider) document.credentials[route.route] = structuredClone(credential);
			await this.writeDocument(document);
		});
	}
	async clearAll() {
		await mkdir(dirname(this.filename), {
			recursive: true,
			mode: 448
		});
		await withFileLock(this.filename, () => rm(this.filename, { force: true }));
	}
};
//#endregion
//#region src/auth.ts
async function loginOfficial(id, interaction, store = new EverythingOAuthStore()) {
	const platform = officialById(id);
	const provider = catalogProvider(id);
	if (platform === void 0 || provider === void 0 || !platform.canLogin) throw new Error(`${id} does not support in-app OAuth`);
	const models = createModels({ credentials: store });
	models.setProvider(provider);
	await models.login(platform.piProvider, "oauth", interaction);
}
async function loginSession(session, id, interaction) {
	await loginOfficial(id, interaction, session.store);
}
//#endregion
//#region src/redact.ts
/** Strip token-like strings from diagnostics that leave the plugin. */
function safeMessage(error) {
	return (error instanceof Error ? error.message : String(error)).replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, "[redacted token]").replace(/(\b(?:code|token|refresh_token|access_token|api[_-]?key|sk-)=)[^&\s]+/giu, "$1[redacted]").replace(/\b(sk-|xai-|gsk_|AIza)[A-Za-z0-9._-]{8,}\b/gu, "[redacted key]").slice(0, 1e3);
}
function hostOf(url) {
	if (url === void 0 || url.length === 0) return void 0;
	try {
		return new URL(url).host;
	} catch {
		return;
	}
}
//#endregion
//#region src/auth-routes.ts
function waitForPromptAbort(prompt) {
	const signal = prompt.signal;
	if (signal === void 0) return new Promise(() => {});
	if (signal.aborted) return Promise.reject(signal.reason);
	return new Promise((_resolve, reject) => {
		signal.addEventListener("abort", () => {
			reject(signal.reason);
		}, { once: true });
	});
}
function trustedRequest(req) {
	const remote = req.socket.remoteAddress;
	if (remote !== "127.0.0.1" && remote !== "::1" && remote !== "::ffff:127.0.0.1") return false;
	if (req.headers["sec-fetch-site"] === "cross-site") return false;
	const host = req.headers.host;
	if (host === void 0) return false;
	const origin = req.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === new URL(`http://${host}`).host;
	} catch {
		return false;
	}
}
async function readJson(req) {
	const chunks = [];
	for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	const text = Buffer.concat(chunks).toString("utf8").trim();
	if (text.length === 0) return {};
	const value = JSON.parse(text);
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}
function json(res, status, value) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"x-content-type-options": "nosniff"
	});
	res.end(JSON.stringify(value));
}
var LoginRunner = class {
	session;
	operation;
	challenge;
	waiters = [];
	constructor(session) {
		this.session = session;
	}
	async start(id) {
		if (this.operation !== void 0 && this.challenge !== void 0) return this.challenge;
		const cancellation = new AbortController();
		this.challenge = void 0;
		this.operation = loginSession(this.session, id, {
			signal: cancellation.signal,
			prompt: (prompt) => prompt.type === "select" ? Promise.resolve(prompt.options.find((option) => option.id.includes("oauth"))?.id ?? prompt.options[0]?.id ?? "oauth") : waitForPromptAbort(prompt),
			notify: (event) => this.onEvent(event)
		}).catch((error) => {
			for (const waiter of this.waiters.splice(0)) waiter.reject(error);
			throw error;
		}).finally(() => {
			this.operation = void 0;
		});
		if (this.challenge !== void 0) return this.challenge;
		return new Promise((resolve, reject) => {
			this.waiters.push({
				resolve,
				reject
			});
		});
	}
	onEvent(event) {
		if (event.type === "device_code") {
			this.accept({
				url: event.verificationUri,
				...event.userCode.length > 0 ? { userCode: event.userCode } : {}
			});
			return;
		}
		if (event.type === "auth_url") this.accept({ url: event.url });
	}
	accept(challenge) {
		try {
			if (new URL(challenge.url).protocol !== "https:") throw new Error("unsafe url");
		} catch {
			const error = /* @__PURE__ */ new Error("provider returned an unsafe authorization URL");
			for (const waiter of this.waiters.splice(0)) waiter.reject(error);
			return;
		}
		this.challenge = challenge;
		for (const waiter of this.waiters.splice(0)) waiter.resolve(challenge);
	}
};
function registerAuthRoutes(ctx, session) {
	const logins = new LoginRunner(session);
	ctx.effect(() => {
		const routes = [
			ctx.webServer.register({
				kind: "exact",
				path: AUTH_STATUS_PATH,
				handler: async (req, res) => {
					if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					json(res, 200, await session.status());
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: AUTH_IMPORT_ALL_PATH,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						json(res, 200, {
							imported: await session.importAll(),
							...await session.status()
						});
					} catch (error) {
						json(res, 500, { error: safeMessage(error) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: AUTH_IMPORT_PATH,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						const body = await readJson(req);
						const ids = Array.isArray(body["ids"]) ? body["ids"].filter((id) => typeof id === "string") : typeof body["id"] === "string" ? [body["id"]] : [];
						if (ids.length === 0) return json(res, 400, { error: "select at least one source" });
						await session.importMany(ids);
						json(res, 200, await session.status());
					} catch (error) {
						json(res, 500, { error: safeMessage(error) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: AUTH_MODELS_PATH,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						const body = await readJson(req);
						const route = typeof body["route"] === "string" ? body["route"] : void 0;
						const enabled = Array.isArray(body["enabled"]) ? body["enabled"].filter((id) => typeof id === "string") : void 0;
						if (route === void 0 || enabled === void 0) return json(res, 400, { error: "route and enabled[] are required" });
						await session.setEnabled(route, enabled);
						json(res, 200, await session.status());
					} catch (error) {
						json(res, 500, { error: safeMessage(error) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: AUTH_LOGIN_PATH,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						const body = await readJson(req);
						const id = typeof body["id"] === "string" ? body["id"] : void 0;
						const platform = id === void 0 ? void 0 : officialById(id);
						if (platform === void 0 || !platform.canLogin) return json(res, 400, { error: "platform does not support OAuth login" });
						json(res, 200, await logins.start(platform.id));
					} catch (error) {
						json(res, 500, { error: safeMessage(error) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: AUTH_LOGOUT_PATH,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					const body = await readJson(req);
					await session.logout(typeof body["id"] === "string" ? body["id"] : void 0);
					json(res, 200, {
						ok: true,
						...await session.status()
					});
				}
			})
		];
		return () => {
			for (const dispose of routes) dispose();
		};
	}, "dsh-everything-oauth: web routes");
}
//#endregion
//#region src/paths.ts
function home(...parts) {
	return resolve(join(homedir(), ...parts));
}
const LIVE_PATHS = {
	claudeSettings: home(".claude", "settings.json"),
	claudeLocalSettings: home(".claude", "settings.local.json"),
	claudeJson: home(".claude.json"),
	claudeCredentials: home(".claude", ".credentials.json"),
	codexAuth: home(".codex", "auth.json"),
	codexConfig: home(".codex", "config.toml"),
	grokAuth: home(".grok", "auth.json"),
	grokConfig: home(".grok", "config.toml"),
	geminiEnv: home(".gemini", ".env"),
	geminiOauth: home(".gemini", "oauth_creds.json"),
	geminiConfigEnv: home(".config", "gemini", ".env"),
	opencodeJson: home(".config", "opencode", "opencode.json"),
	opencodeAuth: home(".local", "share", "opencode", "auth.json"),
	opencodeAccount: home(".local", "share", "opencode", "account.json"),
	copilotHosts: home(".config", "github-copilot", "hosts.json"),
	copilotApps: home(".config", "github-copilot", "apps.json"),
	openclaw: home(".openclaw", "openclaw.json"),
	ccSwitchDb: home(".cc-switch", "cc-switch.db"),
	ccSwitchSettings: home(".cc-switch", "settings.json")
};
const CLAUDE_KEYCHAIN_SERVICES = ["Claude Code-credentials", "Claude Code"];
//#endregion
//#region src/toml.ts
/** Minimal TOML reader for CLI config files (tables + quoted/bare strings). */
function parseSimpleToml(text) {
	const root = {};
	let current = root;
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.replace(/#.*$/, "").trim();
		if (line.length === 0) continue;
		const table = line.match(/^\[\[([^\]]+)\]\]$/) ?? line.match(/^\[([^\]]+)\]$/);
		if (table !== null) {
			current = ensureTable(root, table[1]);
			continue;
		}
		const eq = line.indexOf("=");
		if (eq < 0) continue;
		const key = line.slice(0, eq).trim();
		const value = decodeTomlValue(line.slice(eq + 1).trim());
		current[key] = value;
	}
	return root;
}
function ensureTable(root, path) {
	let node = root;
	for (const part of path.split(".")) {
		const existing = node[part];
		if (isRecord$1(existing)) {
			node = existing;
			continue;
		}
		const next = {};
		node[part] = next;
		node = next;
	}
	return node;
}
function decodeTomlValue(raw) {
	if (raw === "true") return true;
	if (raw === "false") return false;
	if (raw === "null") return null;
	if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
	if (raw.startsWith("\"") && raw.endsWith("\"") || raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1);
	return raw;
}
function parseDotEnv(text) {
	const env = {};
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (line.length === 0 || line.startsWith("#")) continue;
		const eq = line.indexOf("=");
		if (eq < 0) continue;
		const key = line.slice(0, eq).trim();
		let value = line.slice(eq + 1).trim();
		if (value.startsWith("\"") && value.endsWith("\"") || value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
		if (key.length > 0 && value.length > 0) env[key] = value;
	}
	return env;
}
//#endregion
//#region src/discover.ts
const execFileAsync = promisify(execFile);
function exists(filename) {
	return stat(filename).then(() => true, () => false);
}
async function readText(filename) {
	try {
		return await readFile(filename, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return void 0;
		throw error;
	}
}
function apiKeyCredential(key) {
	return {
		type: "api_key",
		key
	};
}
function guessApi(platform, baseURL) {
	if (platform === "claude") return "anthropic-messages";
	if (platform === "codex") return "openai-codex-responses";
	if (platform === "gemini") return "openai-completions";
	if (baseURL?.includes("anthropic") || baseURL?.includes("api.moonshot") || baseURL?.includes("kimi")) return "anthropic-messages";
	return "openai-completions";
}
function source(partial) {
	const base = {
		...partial,
		importable: partial.credential !== void 0,
		...hostOf(partial.baseURL) === void 0 ? {} : { baseHost: hostOf(partial.baseURL) },
		...partial.api === void 0 ? { api: guessApi(partial.platform, partial.baseURL) } : {}
	};
	if (partial.credential === void 0) return base;
	return {
		...base,
		credential: partial.credential
	};
}
async function fromClaudeSettings() {
	const out = [];
	for (const path of [LIVE_PATHS.claudeSettings, LIVE_PATHS.claudeLocalSettings]) {
		const text = await readText(path);
		if (text === void 0) continue;
		const data = parseJsonDocument(text, path);
		const env = isRecord$1(data) && isRecord$1(data["env"]) ? data["env"] : {};
		const key = nonEmptyString(env["ANTHROPIC_API_KEY"]) ?? nonEmptyString(env["ANTHROPIC_AUTH_TOKEN"]);
		const baseURL = nonEmptyString(env["ANTHROPIC_BASE_URL"]);
		const model = nonEmptyString(env["ANTHROPIC_MODEL"]) ?? nonEmptyString(env["ANTHROPIC_DEFAULT_SONNET_MODEL"]);
		out.push(source({
			id: `live:claude:${path}`,
			platform: "claude",
			displayName: "Claude settings.json",
			origin: "Claude Code",
			path,
			kind: key === void 0 ? "oauth" : "api_key",
			baseURL,
			model,
			api: "anthropic-messages",
			...key === void 0 ? {} : { credential: apiKeyCredential(key) }
		}));
	}
	if (await exists(LIVE_PATHS.claudeJson)) out.push(source({
		id: "live:claude-json",
		platform: "claude",
		displayName: "Claude ~/.claude.json",
		origin: "Claude Code",
		path: LIVE_PATHS.claudeJson,
		kind: "oauth"
	}));
	return out;
}
async function fromKeychain() {
	if (process.platform !== "darwin") return [];
	for (const service of CLAUDE_KEYCHAIN_SERVICES) try {
		const { stdout } = await execFileAsync("security", [
			"find-generic-password",
			"-s",
			service,
			"-w"
		], {
			timeout: 4e3,
			maxBuffer: 2097152
		});
		const text = stdout.trim();
		if (text.length === 0) continue;
		let value = text;
		try {
			value = JSON.parse(text);
		} catch {}
		const secret = typeof value === "string" ? {
			credential: apiKeyCredential(value),
			score: 1,
			path: service
		} : bestSecret(value, [
			"claude",
			"anthropic",
			"oauth"
		]);
		return [source({
			id: `keychain:${service}`,
			platform: "claude",
			displayName: "Claude Code keychain",
			origin: "macOS Keychain",
			path: `keychain:${service}`,
			kind: secret?.credential.type === "oauth" ? "oauth" : "api_key",
			api: "anthropic-messages",
			...secret === void 0 ? {} : { credential: secret.credential }
		})];
	} catch {
		continue;
	}
	return [];
}
async function fromCodex() {
	const out = [];
	const authText = await readText(LIVE_PATHS.codexAuth);
	if (authText !== void 0) {
		const data = parseJsonDocument(authText, LIVE_PATHS.codexAuth);
		const secret = bestSecret(data, [
			"codex",
			"openai",
			"chatgpt",
			"tokens"
		]);
		out.push(source({
			id: "live:codex-auth",
			platform: "codex",
			displayName: "Codex auth.json",
			origin: "Codex CLI",
			path: LIVE_PATHS.codexAuth,
			kind: secret?.credential.type === "oauth" ? "oauth" : "api_key",
			api: secret?.credential.type === "oauth" ? "openai-codex-responses" : "openai-completions",
			...secret === void 0 ? {} : { credential: secret.credential }
		}));
	}
	const tomlText = await readText(LIVE_PATHS.codexConfig);
	if (tomlText !== void 0) {
		const data = parseSimpleToml(tomlText);
		const model = nonEmptyString(data["model"]);
		const baseURL = nonEmptyString(data["base_url"]) ?? nonEmptyString(data["openai_base_url"]);
		if (model !== void 0 || baseURL !== void 0) out.push(source({
			id: "live:codex-config",
			platform: "codex",
			displayName: "Codex config.toml",
			origin: "Codex CLI",
			path: LIVE_PATHS.codexConfig,
			kind: "api_key",
			baseURL,
			model
		}));
	}
	return out;
}
async function fromGrok() {
	const out = [];
	const authText = await readText(LIVE_PATHS.grokAuth);
	if (authText !== void 0) {
		const secret = bestSecret(parseJsonDocument(authText, LIVE_PATHS.grokAuth), [
			"xai",
			"grok",
			"auth.x.ai"
		]);
		out.push(source({
			id: "live:grok-auth",
			platform: "grok",
			displayName: "Grok CLI auth.json",
			origin: "Grok CLI",
			path: LIVE_PATHS.grokAuth,
			kind: "oauth",
			api: "openai-responses",
			...secret === void 0 ? {} : { credential: secret.credential }
		}));
	}
	const tomlText = await readText(LIVE_PATHS.grokConfig);
	if (tomlText === void 0) return out;
	const data = parseSimpleToml(tomlText);
	const models = isRecord$1(data["model"]) ? data["model"] : {};
	for (const [name, spec] of Object.entries(models)) {
		if (!isRecord$1(spec)) continue;
		const key = nonEmptyString(spec["api_key"]);
		const envKey = nonEmptyString(spec["env_key"]);
		const envValue = envKey === void 0 ? void 0 : nonEmptyString(process.env[envKey]);
		const credential = key ?? envValue;
		out.push(source({
			id: `live:grok-model:${name}`,
			platform: "custom",
			displayName: nonEmptyString(spec["name"]) ?? name,
			origin: "Grok config.toml",
			path: LIVE_PATHS.grokConfig,
			kind: "api_key",
			baseURL: nonEmptyString(spec["base_url"]),
			model: nonEmptyString(spec["model"]) ?? name,
			api: "openai-completions",
			envKey,
			...credential === void 0 ? {} : { credential: apiKeyCredential(credential) }
		}));
	}
	return out;
}
async function fromGemini() {
	const out = [];
	for (const path of [LIVE_PATHS.geminiEnv, LIVE_PATHS.geminiConfigEnv]) {
		const text = await readText(path);
		if (text === void 0) continue;
		const env = parseDotEnv(text);
		const key = env["GEMINI_API_KEY"] ?? env["GOOGLE_API_KEY"];
		out.push(source({
			id: `live:gemini:${path}`,
			platform: "gemini",
			displayName: "Gemini .env",
			origin: "Gemini CLI",
			path,
			kind: "api_key",
			baseURL: env["GOOGLE_GEMINI_BASE_URL"] ?? env["GEMINI_BASE_URL"],
			model: env["GEMINI_MODEL"],
			api: "openai-completions",
			...key === void 0 ? {} : { credential: apiKeyCredential(key) }
		}));
	}
	const oauthText = await readText(LIVE_PATHS.geminiOauth);
	if (oauthText !== void 0) {
		const secret = bestSecret(parseJsonDocument(oauthText, LIVE_PATHS.geminiOauth), ["google", "gemini"]);
		out.push(source({
			id: "live:gemini-oauth",
			platform: "gemini",
			displayName: "Gemini oauth_creds.json",
			origin: "Gemini CLI",
			path: LIVE_PATHS.geminiOauth,
			kind: "oauth",
			...secret === void 0 ? {} : { credential: secret.credential }
		}));
	}
	return out;
}
async function fromOpenCode() {
	const out = [];
	const jsonText = await readText(LIVE_PATHS.opencodeJson);
	if (jsonText !== void 0) {
		const data = parseJsonDocument(jsonText, LIVE_PATHS.opencodeJson);
		const providers = isRecord$1(data) && isRecord$1(data["provider"]) ? data["provider"] : {};
		if (Object.keys(providers).length === 0) out.push(source({
			id: "live:opencode-json",
			platform: "opencode",
			displayName: "OpenCode opencode.json",
			origin: "OpenCode",
			path: LIVE_PATHS.opencodeJson,
			kind: "api_key"
		}));
		for (const [name, spec] of Object.entries(providers)) {
			if (!isRecord$1(spec)) continue;
			const options = isRecord$1(spec["options"]) ? spec["options"] : spec;
			const key = nonEmptyString(options["apiKey"]) ?? nonEmptyString(options["api_key"]);
			const models = isRecord$1(spec["models"]) ? Object.keys(spec["models"]) : [];
			out.push(source({
				id: `live:opencode:${name}`,
				platform: "opencode",
				displayName: name,
				origin: "OpenCode",
				path: LIVE_PATHS.opencodeJson,
				kind: "api_key",
				baseURL: nonEmptyString(options["baseURL"]) ?? nonEmptyString(options["baseUrl"]),
				models,
				model: models[0],
				api: "openai-completions",
				...key === void 0 ? {} : { credential: apiKeyCredential(key) }
			}));
		}
	}
	const authText = await readText(LIVE_PATHS.opencodeAuth);
	if (authText !== void 0) {
		const data = parseJsonDocument(authText, LIVE_PATHS.opencodeAuth);
		if (isRecord$1(data)) for (const [name, spec] of Object.entries(data)) {
			const secret = bestSecret(spec, [
				name,
				"anthropic",
				"openai",
				"google",
				"xai"
			]);
			const platform = name.includes("anthropic") || name.includes("claude") ? "claude" : name.includes("openai") || name.includes("codex") ? "codex" : name.includes("google") || name.includes("gemini") ? "gemini" : name.includes("xai") || name.includes("grok") ? "grok" : "opencode";
			out.push(source({
				id: `live:opencode-auth:${name}`,
				platform,
				displayName: `OpenCode ${name}`,
				origin: "OpenCode auth.json",
				path: LIVE_PATHS.opencodeAuth,
				kind: secret?.credential.type === "oauth" ? "oauth" : "api_key",
				...secret === void 0 ? {} : { credential: secret.credential }
			}));
		}
	}
	return out;
}
async function fromOpenClaw() {
	const text = await readText(LIVE_PATHS.openclaw);
	if (text === void 0) return [];
	const data = parseJsonDocument(text.replace(/\/\/[^\n]*/g, ""), LIVE_PATHS.openclaw);
	const models = isRecord$1(data) && isRecord$1(data["models"]) ? data["models"] : {};
	const providers = isRecord$1(models["providers"]) ? models["providers"] : {};
	const out = [];
	for (const [name, spec] of Object.entries(providers)) {
		if (!isRecord$1(spec)) continue;
		const key = nonEmptyString(spec["apiKey"]) ?? nonEmptyString(spec["api_key"]);
		const listed = Array.isArray(spec["models"]) ? spec["models"].flatMap((item) => isRecord$1(item) && typeof item["id"] === "string" ? [item["id"]] : []) : [];
		out.push(source({
			id: `live:openclaw:${name}`,
			platform: "custom",
			displayName: name,
			origin: "OpenClaw",
			path: LIVE_PATHS.openclaw,
			kind: "api_key",
			baseURL: nonEmptyString(spec["baseUrl"]) ?? nonEmptyString(spec["baseURL"]),
			models: listed,
			model: listed[0],
			api: spec["api"] === "anthropic-messages" ? "anthropic-messages" : "openai-completions",
			...key === void 0 ? {} : { credential: apiKeyCredential(key) }
		}));
	}
	return out;
}
function ccSwitchPlatform(appType) {
	if (appType === "claude" || appType === "codex" || appType === "gemini" || appType === "opencode") return appType;
	if (appType === "grok" || appType === "grokbuild") return "grok";
	return "custom";
}
function fromCcSwitchConfig(id, appType, name, configText) {
	let config;
	try {
		config = JSON.parse(configText);
	} catch {
		return;
	}
	const env = isRecord$1(config) && isRecord$1(config["env"]) ? config["env"] : {};
	const auth = isRecord$1(config) && isRecord$1(config["auth"]) ? config["auth"] : {};
	const platform = ccSwitchPlatform(appType);
	const official = officialById(platform === "custom" ? "" : platform);
	const anthropicKey = nonEmptyString(env["ANTHROPIC_API_KEY"]) ?? nonEmptyString(env["ANTHROPIC_AUTH_TOKEN"]);
	const openaiKey = nonEmptyString(auth["OPENAI_API_KEY"]);
	const geminiKey = nonEmptyString(env["GEMINI_API_KEY"]);
	const secret = bestSecret({
		env,
		auth,
		config
	}, [
		appType,
		name,
		platform
	]);
	const credential = anthropicKey !== void 0 ? apiKeyCredential(anthropicKey) : openaiKey !== void 0 ? apiKeyCredential(openaiKey) : geminiKey !== void 0 ? apiKeyCredential(geminiKey) : secret?.credential;
	const models = [
		nonEmptyString(env["ANTHROPIC_MODEL"]),
		nonEmptyString(env["ANTHROPIC_DEFAULT_SONNET_MODEL"]),
		nonEmptyString(env["ANTHROPIC_DEFAULT_OPUS_MODEL"]),
		nonEmptyString(env["ANTHROPIC_DEFAULT_HAIKU_MODEL"])
	].filter((item) => item !== void 0);
	const baseURL = nonEmptyString(env["ANTHROPIC_BASE_URL"]) ?? nonEmptyString(env["OPENAI_BASE_URL"]) ?? nonEmptyString(env["GEMINI_BASE_URL"]);
	return source({
		id: `ccswitch:${appType}:${id}`,
		platform,
		displayName: `${name} (CC Switch)`,
		origin: "CC Switch",
		path: LIVE_PATHS.ccSwitchDb,
		kind: credential?.type === "oauth" ? "oauth" : "api_key",
		baseURL,
		models,
		model: models[0],
		api: anthropicKey !== void 0 || baseURL !== void 0 && platform === "claude" ? "anthropic-messages" : official?.id === "codex" && credential?.type === "oauth" ? "openai-codex-responses" : guessApi(platform, baseURL),
		...credential === void 0 ? {} : { credential }
	});
}
async function fromCcSwitch() {
	if (!await exists(LIVE_PATHS.ccSwitchDb)) return [];
	try {
		const { DatabaseSync } = await import("node:sqlite");
		const db = new DatabaseSync(LIVE_PATHS.ccSwitchDb, { readOnly: true });
		try {
			return db.prepare("SELECT id, app_type, name, settings_config FROM providers").all().flatMap((row) => {
				const item = fromCcSwitchConfig(row.id, row.app_type, row.name, row.settings_config);
				return item === void 0 ? [] : [item];
			});
		} finally {
			db.close();
		}
	} catch {
		return [source({
			id: "ccswitch:db",
			platform: "custom",
			displayName: "CC Switch database",
			origin: "CC Switch",
			path: LIVE_PATHS.ccSwitchDb,
			kind: "api_key"
		})];
	}
}
async function fromProcessEnv() {
	return [
		[
			"claude",
			"ANTHROPIC_API_KEY",
			"anthropic-messages"
		],
		[
			"claude",
			"ANTHROPIC_AUTH_TOKEN",
			"anthropic-messages"
		],
		[
			"codex",
			"OPENAI_API_KEY",
			"openai-completions"
		],
		[
			"grok",
			"XAI_API_KEY",
			"openai-completions"
		],
		[
			"gemini",
			"GEMINI_API_KEY",
			"openai-completions"
		]
	].flatMap(([platform, envKey, api]) => {
		const key = nonEmptyString(process.env[envKey]);
		if (key === void 0) return [];
		return [source({
			id: `env:${envKey}`,
			platform,
			displayName: envKey,
			origin: "process env",
			path: `env:${envKey}`,
			kind: "api_key",
			api,
			envKey,
			credential: apiKeyCredential(key)
		})];
	});
}
function isImportable(item) {
	return "credential" in item && item.credential !== void 0;
}
function publicSource(item) {
	const { credential: _credential, ...rest } = item;
	return rest;
}
/** Scan CC Switch + live coding-tool configs. Secrets stay on ImportableSource only. */
async function discoverSources() {
	const groups = await Promise.all([
		fromCcSwitch(),
		fromClaudeSettings(),
		fromKeychain(),
		fromCodex(),
		fromGrok(),
		fromGemini(),
		fromOpenCode(),
		fromOpenClaw(),
		fromProcessEnv()
	]);
	const seen = /* @__PURE__ */ new Set();
	const merged = [];
	for (const item of groups.flat()) {
		if (seen.has(item.id)) continue;
		seen.add(item.id);
		merged.push(item);
	}
	return merged;
}
function routeForDiscovered(item) {
	const official = officialById(item.platform);
	if (official !== void 0 && item.origin !== "Grok config.toml" && item.origin !== "OpenClaw") {
		if (item.platform !== "custom" && (item.kind === "oauth" || item.origin === "process env" || item.origin === "Claude Code" || item.origin === "Codex CLI" || item.origin === "Grok CLI" || item.origin === "Gemini CLI" || item.origin === "macOS Keychain")) {
			if (!(item.origin === "CC Switch" && item.baseURL !== void 0)) return official.route;
		}
	}
	return `everything-${slugify(`${item.origin}-${item.displayName}`)}`;
}
//#endregion
//#region src/session.ts
var EverythingOAuthSession = class {
	store;
	models;
	onChange;
	constructor(store = new EverythingOAuthStore(), onChange) {
		this.store = store;
		this.onChange = onChange;
		this.models = createModels({ credentials: store });
		for (const platform of OFFICIAL_PLATFORMS) {
			const provider = catalogProvider(platform.id);
			if (provider !== void 0) this.models.setProvider(provider);
		}
	}
	async discover() {
		return (await discoverSources()).map(publicSource);
	}
	async importOne(id) {
		const item = (await this.importMany([id]))[0];
		if (item === void 0) throw new Error(`nothing importable at ${id}`);
		return item;
	}
	async importMany(ids) {
		const wanted = new Set(ids);
		const imported = [];
		for (const item of await discoverSources()) {
			if (!wanted.has(item.id) || !isImportable(item)) continue;
			await this.persist(item);
			imported.push(publicSource(item));
		}
		if (imported.length === 0) throw new Error("select at least one importable source");
		this.onChange?.();
		return imported;
	}
	async importAll() {
		const ids = (await discoverSources()).filter(isImportable).map((item) => item.id);
		return this.importMany(ids);
	}
	defaultEnabled(item, available, officialDefault) {
		const declared = item.models ?? (item.model === void 0 ? [] : [item.model]);
		const preferred = declared.filter((id) => available.includes(id) || declared.length > 0);
		if (preferred.length > 0) return [...new Set(preferred)];
		if (officialDefault !== void 0 && available.includes(officialDefault)) return [officialDefault];
		return available.slice(0, 1);
	}
	async persist(item) {
		const routeId = routeForDiscovered(item);
		const official = item.platform === "custom" ? void 0 : officialById(item.platform);
		const useOfficial = official !== void 0 && routeId === official.route;
		const existing = (await this.store.snapshot()).routes[routeId];
		const declared = item.models ?? (item.model === void 0 ? [] : [item.model]);
		let available = useOfficial ? [.../* @__PURE__ */ new Set([...catalogModelIds(official.id), ...declared])] : [...new Set(declared)];
		if (useOfficial && official.liveModelsUrl !== void 0) {
			const token = item.credential.type === "oauth" ? item.credential.access : item.credential.key;
			if (token !== void 0) try {
				const { fetchLiveModelIds } = await import("./live-models-DI9ZIkLe.js");
				available = [.../* @__PURE__ */ new Set([...available, ...await fetchLiveModelIds(official.liveModelsUrl, token)])];
			} catch {}
		}
		const enabled = existing?.enabled.length ? existing.enabled : this.defaultEnabled(item, available, official?.defaultModel);
		const route = {
			route: routeId,
			displayName: useOfficial ? official.displayName : item.displayName,
			piProvider: useOfficial ? official.piProvider : routeId,
			api: item.api ?? "openai-completions",
			models: available,
			enabled,
			sourceId: item.id,
			origin: item.origin,
			...item.baseURL === void 0 ? {} : { baseURL: item.baseURL }
		};
		await this.store.putRoute(route, item.credential);
		const catalog = official !== void 0 && useOfficial ? catalogProvider(official.id) : void 0;
		if (catalog !== void 0) this.models.setProvider(catalog);
	}
	async setEnabled(routeId, enabled) {
		const unique = [...new Set(enabled.filter((id) => id.length > 0))];
		if (await this.store.patchRoute(routeId, { enabled: unique }) === void 0) throw new Error(`route ${routeId} is not imported`);
		this.onChange?.();
	}
	async status() {
		const document = await this.store.snapshot();
		const importedSources = new Set(Object.values(document.routes).map((route) => route.sourceId));
		const discovered = (await this.discover()).map((item) => ({
			...item,
			imported: importedSources.has(item.id)
		}));
		const platforms = [];
		for (const route of Object.values(document.routes)) {
			const official = officialByRoute(route.route);
			const available = official === void 0 ? route.models : [.../* @__PURE__ */ new Set([...catalogModelIds(official.id), ...route.models])];
			platforms.push({
				id: official?.id ?? route.route,
				route: route.route,
				displayName: route.displayName,
				signedIn: true,
				canLogin: official?.canLogin ?? false,
				origin: route.origin,
				sourceId: route.sourceId,
				available,
				enabled: route.enabled,
				kind: (document.credentials[route.piProvider] ?? document.credentials[route.route])?.type === "oauth" ? "oauth" : "api_key"
			});
		}
		return {
			platforms,
			discovered
		};
	}
	async logout(id) {
		if (id === void 0 || id === "all") {
			await this.store.clearAll();
			this.onChange?.();
			return;
		}
		const official = officialById(id) ?? officialByRoute(id);
		await this.store.delete(official?.route ?? official?.piProvider ?? id);
		this.onChange?.();
	}
	async resolveAccess(route) {
		const document = await this.store.snapshot();
		const official = officialById(route) ?? officialByPi(route);
		const stored = document.routes[route];
		const providerId = official?.piProvider ?? stored?.piProvider ?? route;
		const apiKey = (await this.models.getAuth(providerId))?.auth.apiKey;
		if (apiKey !== void 0 && apiKey.length > 0) return apiKey;
		const credential = document.credentials[providerId] ?? document.credentials[route];
		if (credential?.type === "api_key" && credential.key !== void 0) return credential.key;
		if (credential?.type === "oauth") return credential.access;
		throw new LlmError(`${official?.displayName ?? route} is not imported. Open Settings → Everything OAuth and import a local login.`, "MISSING_CREDENTIAL");
	}
	async profiles() {
		const document = await this.store.snapshot();
		const profiles = /* @__PURE__ */ new Map();
		const retryPolicy = resolveRetryPolicy(void 0, "dsh-everything-oauth retryPolicy");
		const add = (route, displayName, provider) => {
			profiles.set(route, {
				provider: route,
				displayName,
				streamIdleTimeoutMs: STREAM_IDLE_TIMEOUT_MS,
				retryPolicy,
				configuredMaxTokens: /* @__PURE__ */ new Map(),
				piProvider: provider
			});
		};
		for (const route of Object.values(document.routes)) {
			if (route.enabled.length === 0) continue;
			const official = officialByRoute(route.route);
			if (official !== void 0) {
				const runtime = officialRuntimeProvider(official.id, route.baseURL, route.enabled);
				if (runtime !== void 0) add(route.route, route.displayName, runtime);
				continue;
			}
			add(route.route, route.displayName, customProvider(route));
		}
		return profiles;
	}
};
function createEverythingAdapterSync(session, resolveAttachments, cache) {
	return new PiAiAdapter({
		profiles: () => cache.current,
		resolveApiKey: async (provider) => session.resolveAccess(provider),
		resolveAttachments
	});
}
//#endregion
//#region src/index.ts
const name = "llm-everything-oauth";
const inject = ["llm"];
const Config = z.object({});
function apply(ctx, _config) {
	const cache = { current: /* @__PURE__ */ new Map() };
	let session;
	let adapter;
	let handle;
	const reconcile = async () => {
		cache.current = await session.profiles();
		const routes = [...cache.current.keys()];
		if (handle === void 0 && routes.length > 0) handle = ctx.llm.registerAdapter(routes, adapter);
		else if (handle !== void 0) handle.replace(routes);
		ctx.emit("llm/adapters-updated");
	};
	session = new EverythingOAuthSession(new EverythingOAuthStore(), () => {
		reconcile();
	});
	adapter = createEverythingAdapterSync(session, () => ctx.get("attachments"), cache);
	ctx.inject(["webServer"], (webCtx) => registerAuthRoutes(webCtx, session));
	reconcile();
}
//#endregion
export { Config, EverythingOAuthSession, EverythingOAuthStore, OFFICIAL_PLATFORMS, apply, discoverSources, everythingOAuthPath, inject, loginOfficial, name, publicSource };
