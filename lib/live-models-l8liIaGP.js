import { n as isRecord } from "./parse-oauth-B1HG3gXh.js";
//#region src/live-models.ts
const BODY_LIMIT = 4194304;
/** Build conventional model-list endpoints without dropping a gateway path prefix. */
function modelListingUrls(baseURL) {
	try {
		const base = new URL(baseURL);
		base.search = "";
		base.hash = "";
		const path = base.pathname.replace(/\/+$/, "");
		const paths = [`${path.endsWith("/v1") ? path : `${path}/v1`}/models`, `${path}/models`];
		return [...new Set(paths.map((pathname) => {
			const target = new URL(base);
			target.pathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
			return target.toString();
		}))];
	} catch {
		return [];
	}
}
/** Pull model ids from an OpenAI-shaped listing. Never returns the body. */
function stringList(value) {
	if (!Array.isArray(value)) return void 0;
	const values = value.flatMap((item) => {
		if (typeof item === "string" && item.length > 0) return [item];
		if (isRecord(item) && typeof item["id"] === "string" && item["id"].length > 0) return [item["id"]];
		if (isRecord(item) && typeof item["name"] === "string" && item["name"].length > 0) return [item["name"]];
		return [];
	});
	return [...new Set(values)];
}
function readReasoningEfforts(row) {
	for (const key of [
		"reasoning_efforts",
		"reasoningEfforts",
		"supported_reasoning_efforts",
		"supportedReasoningEfforts",
		"thinking_levels",
		"thinkingLevels",
		"efforts",
		"levels"
	]) {
		const values = stringList(row[key]);
		if (values !== void 0) return values;
	}
	for (const containerKey of ["reasoning", "capabilities"]) {
		const container = row[containerKey];
		if (!isRecord(container)) continue;
		const nested = readReasoningEfforts(container);
		if (nested !== void 0) return nested;
	}
}
function extractModelInfo(body) {
	const rows = Array.isArray(body) ? body : isRecord(body) && Array.isArray(body["data"]) ? body["data"] : isRecord(body) && Array.isArray(body["models"]) ? body["models"] : [];
	const models = [];
	const seen = /* @__PURE__ */ new Set();
	for (const row of rows) {
		const id = typeof row === "string" ? row : isRecord(row) && typeof row["id"] === "string" ? row["id"] : void 0;
		if (id === void 0 || id.length === 0 || seen.has(id)) continue;
		seen.add(id);
		models.push({
			id,
			...isRecord(row) && readReasoningEfforts(row) !== void 0 ? { reasoningEfforts: readReasoningEfforts(row) } : {}
		});
	}
	return models;
}
async function fetchLiveModelIds(url, accessToken, signal) {
	return (await fetchLiveModels(url, accessToken, signal)).map((model) => model.id);
}
async function fetchLiveModels(url, accessToken, signal) {
	const response = await fetch(url, {
		headers: {
			accept: "application/json",
			authorization: `Bearer ${accessToken}`
		},
		signal
	});
	const raw = Buffer.from(await response.arrayBuffer());
	if (raw.byteLength > BODY_LIMIT) throw new Error("model listing exceeded 4 MiB");
	const body = JSON.parse(raw.toString("utf8"));
	if (!response.ok) throw new Error(`model listing failed (HTTP ${response.status})`);
	const models = extractModelInfo(body);
	if (models.length === 0) throw new Error("model listing contained no ids");
	return models;
}
//#endregion
export { fetchLiveModelIds, fetchLiveModels, modelListingUrls };
