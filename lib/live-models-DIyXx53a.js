import { n as isRecord } from "./parse-oauth-B7UckaTZ.js";
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
function extractModelIds(body) {
	const rows = Array.isArray(body) ? body : isRecord(body) && Array.isArray(body["data"]) ? body["data"] : isRecord(body) && Array.isArray(body["models"]) ? body["models"] : [];
	const ids = [];
	for (const row of rows) if (typeof row === "string" && row.length > 0) ids.push(row);
	else if (isRecord(row) && typeof row["id"] === "string" && row["id"].length > 0) ids.push(row["id"]);
	return [...new Set(ids)];
}
async function fetchLiveModelIds(url, accessToken, signal) {
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
	const ids = extractModelIds(body);
	if (ids.length === 0) throw new Error("model listing contained no ids");
	return ids;
}
//#endregion
export { fetchLiveModelIds, modelListingUrls };
