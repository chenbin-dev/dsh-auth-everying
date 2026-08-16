//#region src/ids.ts
/** Harness-home document owned by this bundle. */
const STORE_FILENAME = ".auth-everying.json";
/** Web route prefix. */
const PLUGIN_PATH = "/plugins/dsh-auth-everying";
const AUTH_STATUS_PATH = `${PLUGIN_PATH}/auth/status`;
const AUTH_IMPORT_PATH = `${PLUGIN_PATH}/auth/import`;
const AUTH_IMPORT_ALL_PATH = `${PLUGIN_PATH}/auth/import-all`;
const AUTH_LOGIN_PATH = `${PLUGIN_PATH}/auth/login`;
const AUTH_LOGOUT_PATH = `${PLUGIN_PATH}/auth/logout`;
const AUTH_MODELS_PATH = `${PLUGIN_PATH}/auth/models`;
const STREAM_IDLE_TIMEOUT_MS = 3e5;
const DEFAULT_CONTEXT_WINDOW = 262144;
const DEFAULT_MAX_TOKENS = 32768;
const DEFAULT_TOKEN_LIFETIME_MS = 36e5;
const OFFICIAL_PLATFORMS = [
	{
		id: "claude",
		route: "claude-oauth",
		piProvider: "anthropic",
		displayName: "Claude",
		defaultModel: "claude-sonnet-4-5",
		canLogin: true
	},
	{
		id: "codex",
		route: "codex-oauth",
		piProvider: "openai-codex",
		displayName: "Codex",
		defaultModel: "gpt-5.4",
		canLogin: true
	},
	{
		id: "grok",
		route: "grok-oauth",
		piProvider: "xai",
		displayName: "Grok",
		defaultModel: "grok-4.6",
		canLogin: true,
		liveModelsUrl: "https://api.x.ai/v1/models"
	},
	{
		id: "gemini",
		route: "gemini-oauth",
		piProvider: "google",
		displayName: "Gemini",
		defaultModel: "gemini-2.5-pro",
		canLogin: false
	},
	{
		id: "copilot",
		route: "copilot-oauth",
		piProvider: "github-copilot",
		displayName: "GitHub Copilot",
		defaultModel: "gpt-5.4",
		canLogin: true
	},
	{
		id: "opencode",
		route: "opencode-oauth",
		piProvider: "opencode",
		displayName: "OpenCode",
		defaultModel: "gpt-5.4",
		canLogin: false
	}
];
function officialById(id) {
	return OFFICIAL_PLATFORMS.find((platform) => platform.id === id);
}
function officialByRoute(route) {
	return OFFICIAL_PLATFORMS.find((platform) => platform.route === route);
}
function officialByPi(piProvider) {
	return OFFICIAL_PLATFORMS.find((platform) => platform.piProvider === piProvider);
}
/** Models the installed pi-ai catalog has not caught up with yet. */
const EXTRA_CATALOG_MODELS = { grok: ["grok-4.6"] };
function slugify(value) {
	const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
	return slug.length > 0 ? slug : "custom";
}
//#endregion
//#region src/parse-oauth.ts
const ACCESS_KEYS = [
	"access",
	"access_token",
	"accessToken",
	"key",
	"oauth_token",
	"token"
];
const REFRESH_KEYS = [
	"refresh",
	"refresh_token",
	"refreshToken"
];
const ACCOUNT_KEYS = [
	"account_id",
	"accountId",
	"user_id",
	"chatgpt_account_id",
	"principal_id"
];
const API_KEY_KEYS = [
	"ANTHROPIC_API_KEY",
	"ANTHROPIC_AUTH_TOKEN",
	"OPENAI_API_KEY",
	"XAI_API_KEY",
	"GEMINI_API_KEY",
	"GOOGLE_API_KEY",
	"DEEPSEEK_API_KEY",
	"KIMI_CODE_API_KEY",
	"api_key",
	"apiKey",
	"api-key"
];
const SKIP_SEGMENTS = [
	"mcp",
	"mcpServers",
	"mcp_servers",
	"headers",
	"plugin"
];
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nonEmptyString(value) {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : void 0;
}
function firstString(record, keys) {
	for (const key of keys) {
		const value = nonEmptyString(record[key]);
		if (value !== void 0) return value;
	}
}
function parseTime(value) {
	const parsed = Date.parse(value);
	if (Number.isFinite(parsed) && parsed > 0) return parsed;
	const trimmed = value.replace(/(\.\d{3})\d+/, "$1");
	const again = Date.parse(trimmed);
	return Number.isFinite(again) && again > 0 ? again : NaN;
}
function parseExpires(record) {
	for (const key of [
		"expires_at",
		"expiresAt",
		"expiry_date",
		"expiryDate",
		"expires"
	]) {
		const value = record[key];
		if (typeof value === "string" && value.length > 0) {
			const parsed = parseTime(value);
			if (Number.isFinite(parsed)) return parsed;
		}
		if (typeof value === "number" && Number.isFinite(value) && value > 0) return value < 0xe8d4a51000 ? value * 1e3 : value;
	}
	const expiresIn = record["expires_in"] ?? record["expiresIn"];
	if (typeof expiresIn === "number" && Number.isFinite(expiresIn) && expiresIn > 0) return Date.now() + expiresIn * 1e3;
	return Date.now() + DEFAULT_TOKEN_LIFETIME_MS;
}
function scorePath(path, hints) {
	const lower = path.toLowerCase();
	let score = 0;
	for (const hint of hints) if (lower.includes(hint.toLowerCase())) score += 10;
	if (lower.includes("auth.x.ai")) score += 8;
	if (lower.includes("oauth")) score += 4;
	if (lower.includes("tokens")) score += 3;
	return score;
}
function skipped(path) {
	return path.split(".").some((segment) => SKIP_SEGMENTS.includes(segment));
}
function walk(value, path, hints, into) {
	if (Array.isArray(value)) {
		value.forEach((item, index) => walk(item, `${path}[${index}]`, hints, into));
		return;
	}
	if (!isRecord(value) || skipped(path)) return;
	const access = firstString(value, ACCESS_KEYS);
	const refresh = firstString(value, REFRESH_KEYS);
	const accountId = firstString(value, ACCOUNT_KEYS);
	if (access !== void 0 && refresh !== void 0) into.push({
		credential: {
			type: "oauth",
			access,
			refresh,
			expires: parseExpires(value),
			...accountId === void 0 ? {} : { accountId }
		},
		score: scorePath(path, hints) + 20,
		path,
		...accountId === void 0 ? {} : { accountId }
	});
	const apiKey = firstString(value, API_KEY_KEYS);
	if (apiKey !== void 0 && refresh === void 0) into.push({
		credential: {
			type: "api_key",
			key: apiKey
		},
		score: scorePath(path, hints) + 5,
		path
	});
	for (const [child, nested] of Object.entries(value)) walk(nested, path.length === 0 ? child : `${path}.${child}`, hints, into);
}
/** Collect OAuth and API-key candidates from a JSON-like document. */
function collectSecrets(value, hints = []) {
	const found = [];
	walk(value, "", hints, found);
	return found.sort((left, right) => right.score - left.score);
}
function bestSecret(value, hints = []) {
	return collectSecrets(value, hints)[0];
}
function parseJsonDocument(text, filename) {
	try {
		return JSON.parse(text);
	} catch {
		throw new Error(`${filename} is not valid JSON`);
	}
}
//#endregion
export { officialById as _, AUTH_IMPORT_ALL_PATH as a, slugify as b, AUTH_LOGOUT_PATH as c, DEFAULT_CONTEXT_WINDOW as d, DEFAULT_MAX_TOKENS as f, STREAM_IDLE_TIMEOUT_MS as g, STORE_FILENAME as h, parseJsonDocument as i, AUTH_MODELS_PATH as l, OFFICIAL_PLATFORMS as m, isRecord as n, AUTH_IMPORT_PATH as o, EXTRA_CATALOG_MODELS as p, nonEmptyString as r, AUTH_LOGIN_PATH as s, bestSecret as t, AUTH_STATUS_PATH as u, officialByPi as v, officialByRoute as y };
