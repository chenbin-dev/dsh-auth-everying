window.__ModuleLoader__.load({
	id: "dsh-everything-oauth",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react = require("react");
let react_jsx_runtime = require("react/jsx-runtime");
//#region src/client/Settings.tsx
const STATUS = "/plugins/dsh-everything-oauth/auth/status";
const IMPORT = "/plugins/dsh-everything-oauth/auth/import";
const MODELS = "/plugins/dsh-everything-oauth/auth/models";
const LOGOUT = "/plugins/dsh-everything-oauth/auth/logout";
const CSS_ID = "dsh-everything-oauth/settings.css";
const css = `
.eo_section{max-width:760px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:12px;display:flex}
.eo_heading{margin:0;font-size:18px;font-weight:600}
.eo_intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px}
.eo_tabs{border-bottom:1px solid var(--dsw-alias-border-l2);align-items:flex-end;gap:22px;margin-top:2px;display:flex}
.eo_tab{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;padding:7px 1px 9px;font-size:13px;line-height:20px;position:relative}
.eo_tab:hover,.eo_tab[data-active=true]{color:var(--dsw-alias-label-primary)}
.eo_tab[data-active=true]:after,.eo_tab:focus-visible:after{background:var(--dsw-alias-label-primary);content:"";border-radius:2px 2px 0 0;height:2px;position:absolute;bottom:-1px;left:0;right:0}
.eo_tab:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px;color:var(--dsw-alias-label-primary);border-radius:2px}
.eo_panel{min-width:0;padding-top:14px;display:flex;flex-direction:column;gap:12px}
.eo_empty{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px}
.eo_toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.eo_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px;line-height:1.5}
.eo_error{color:var(--dsw-alias-state-error-primary);margin:0;font-size:13px}
.eo_cards{flex-direction:column;gap:10px;margin:0;padding:0;list-style:none;display:flex}
.eo_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}
.eo_card:hover{border-color:var(--dsw-alias-label-dimmed)}
.eo_cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}
.eo_header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}
.eo_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.eo_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}
.eo_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}
.eo_description{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}
.eo_badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}
.eo_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}
.eo_chevronOpen{transform:rotate(180deg)}
.eo_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding:12px 0 8px;display:flex;flex-direction:column;gap:10px}
.eo_models{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
.eo_check{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--dsw-alias-label-primary)}
.eo_mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}
.eo_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}
.eo_btn,.eo_primary{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}
.eo_btn{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}
.eo_btn:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}
.eo_primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.eo_btn:disabled,.eo_primary:disabled{opacity:.4;cursor:default}
.eo_source{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;align-items:flex-start;gap:12px;padding:14px 16px;display:flex}
.eo_source:hover{border-color:var(--dsw-alias-label-dimmed)}
`;
function ensureCss() {
	if (typeof document === "undefined") return;
	if (document.querySelector(`style[data-plugin-css=${JSON.stringify(CSS_ID)}]`)) return;
	const tag = document.createElement("style");
	tag.dataset.plugin = "dsh-everything-oauth";
	tag.dataset.pluginCss = CSS_ID;
	tag.textContent = css;
	document.head.appendChild(tag);
}
async function jsonRequest(path, method = "GET", payload) {
	const response = await fetch(path, {
		method,
		credentials: "same-origin",
		headers: {
			accept: "application/json",
			...payload === void 0 ? {} : { "content-type": "application/json" }
		},
		...payload === void 0 ? {} : { body: JSON.stringify(payload) }
	});
	const value = await response.json().catch(() => void 0);
	if (!response.ok) {
		const message = typeof value === "object" && value !== null && "error" in value && typeof value.error === "string" ? value.error : `HTTP ${response.status}`;
		throw new Error(message);
	}
	return value;
}
const chevron = {
	width: 16,
	height: 16,
	display: "block"
};
function EverythingSettings({ t }) {
	if (t === void 0) throw new Error("Everything OAuth settings requires t");
	ensureCss();
	const tabsId = (0, react.useId)();
	const tabRefs = (0, react.useRef)([]);
	const [tab, setTab] = (0, react.useState)("config");
	const [openRoute, setOpenRoute] = (0, react.useState)();
	const [status, setStatus] = (0, react.useState)();
	const [selected, setSelected] = (0, react.useState)(/* @__PURE__ */ new Set());
	const [message, setMessage] = (0, react.useState)();
	const [busy, setBusy] = (0, react.useState)(false);
	const tabs = [{
		id: "config",
		label: t("tabConfig")
	}, {
		id: "sources",
		label: t("tabSources")
	}];
	const refresh = (0, react.useCallback)(async () => {
		setStatus(await jsonRequest(STATUS));
	}, []);
	(0, react.useEffect)(() => {
		refresh().catch((err) => {
			setMessage(err instanceof Error ? err.message : t("requestFailed"));
		});
	}, [refresh, t]);
	const run = async (work) => {
		setBusy(true);
		setMessage(void 0);
		try {
			await work();
			await refresh();
		} catch (err) {
			setMessage(err instanceof Error ? err.message : t("requestFailed"));
		} finally {
			setBusy(false);
		}
	};
	const importable = (status?.discovered ?? []).filter((item) => item.importable && item.imported !== true);
	const onTabKey = (event, index) => {
		let next = index;
		if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
		else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
		else if (event.key === "Home") next = 0;
		else if (event.key === "End") next = tabs.length - 1;
		else return;
		event.preventDefault();
		const nextTab = tabs[next];
		if (nextTab === void 0) return;
		setTab(nextTab.id);
		tabRefs.current[next]?.focus();
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "eo_section",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
				className: "eo_heading",
				children: t("title")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "eo_intro",
				children: t("intro")
			}),
			message === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "eo_error",
				children: message
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "eo_tabs",
				role: "tablist",
				"aria-label": t("title"),
				children: tabs.map((item, index) => {
					const active = item.id === tab;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						ref: (element) => {
							tabRefs.current[index] = element;
						},
						id: `${tabsId}-tab-${item.id}`,
						type: "button",
						role: "tab",
						className: "eo_tab",
						"aria-selected": active,
						"aria-controls": `${tabsId}-panel-${item.id}`,
						"data-active": active ? "true" : void 0,
						tabIndex: active ? 0 : -1,
						onClick: () => {
							setTab(item.id);
						},
						onKeyDown: (event) => {
							onTabKey(event, index);
						},
						children: item.label
					}, item.id);
				})
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				id: `${tabsId}-panel-config`,
				className: "eo_panel",
				role: "tabpanel",
				"aria-labelledby": `${tabsId}-tab-config`,
				hidden: tab !== "config",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "eo_toolbar",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "eo_hint",
						children: t("hint")
					}), (status?.platforms ?? []).length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "eo_btn",
						disabled: busy,
						onClick: () => {
							run(async () => {
								await jsonRequest(LOGOUT, "POST", {});
							});
						},
						children: t("logoutAll")
					}) : null]
				}), (status?.platforms ?? []).length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "eo_empty",
					children: t("noneImported")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
					className: "eo_cards",
					children: (status?.platforms ?? []).map((platform) => {
						const open = openRoute === platform.route;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							className: open ? "eo_card eo_cardOpen" : "eo_card",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "eo_header",
								"aria-expanded": open,
								"aria-label": `${t(open ? "collapse" : "expand")}: ${platform.displayName}`,
								onClick: () => {
									setOpenRoute(open ? void 0 : platform.route);
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "eo_headText",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "eo_name",
											children: platform.displayName
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "eo_description",
											children: [platform.route, platform.origin === void 0 ? "" : ` · ${platform.origin}`]
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "eo_badge",
										children: t("enabledCount").replace("{n}", String(platform.enabled.length))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
										className: open ? "eo_chevron eo_chevronOpen" : "eo_chevron",
										style: chevron,
										viewBox: "0 0 16 16",
										"aria-hidden": "true",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
											d: "M4 6l4 4 4-4",
											fill: "none",
											stroke: "currentColor",
											strokeWidth: "1.5",
											strokeLinecap: "round",
											strokeLinejoin: "round"
										})
									})
								]
							}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "eo_body",
								children: [platform.available.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "eo_empty",
									children: t("noModels")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: "eo_models",
									children: platform.available.map((id) => {
										const on = platform.enabled.includes(id);
										return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: "eo_check",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: on,
												disabled: busy,
												onChange: () => {
													const next = new Set(platform.enabled);
													if (on) next.delete(id);
													else next.add(id);
													run(async () => {
														await jsonRequest(MODELS, "POST", {
															route: platform.route,
															enabled: [...next]
														});
													});
												}
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "eo_mono",
												children: id
											})]
										}) }, id);
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "eo_footer",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "eo_btn",
											disabled: busy,
											onClick: () => {
												run(async () => {
													await jsonRequest(MODELS, "POST", {
														route: platform.route,
														enabled: platform.available
													});
												});
											},
											children: t("enableAll")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "eo_btn",
											disabled: busy,
											onClick: () => {
												run(async () => {
													await jsonRequest(MODELS, "POST", {
														route: platform.route,
														enabled: []
													});
												});
											},
											children: t("enableNone")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "eo_btn",
											disabled: busy,
											onClick: () => {
												run(async () => {
													await jsonRequest(LOGOUT, "POST", { id: platform.route });
												});
											},
											children: t("logout")
										})
									]
								})]
							}) : null]
						}, platform.route);
					})
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				id: `${tabsId}-panel-sources`,
				className: "eo_panel",
				role: "tabpanel",
				"aria-labelledby": `${tabsId}-tab-sources`,
				hidden: tab !== "sources",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "eo_toolbar",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "eo_primary",
							disabled: busy || selected.size === 0,
							onClick: () => {
								run(async () => {
									await jsonRequest(IMPORT, "POST", { ids: [...selected] });
									setSelected(/* @__PURE__ */ new Set());
									setTab("config");
								});
							},
							children: busy ? t("working") : `${t("importSelected")} (${selected.size})`
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "eo_btn",
							disabled: busy || importable.length === 0,
							onClick: () => {
								setSelected(new Set(importable.map((item) => item.id)));
							},
							children: t("selectImportable")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "eo_btn",
							disabled: busy,
							onClick: () => {
								setSelected(/* @__PURE__ */ new Set());
							},
							children: t("clearSelection")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "eo_btn",
							disabled: busy,
							onClick: () => {
								run(async () => {
									await refresh();
								});
							},
							children: t("scan")
						})
					]
				}), (status?.discovered ?? []).length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "eo_empty",
					children: t("none")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
					className: "eo_cards",
					children: (status?.discovered ?? []).map((item) => {
						const locked = !item.importable || item.imported === true;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "eo_source",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									disabled: locked || busy,
									checked: item.imported === true || selected.has(item.id),
									onChange: (event) => {
										setSelected((current) => {
											const next = new Set(current);
											if (event.target.checked) next.add(item.id);
											else next.delete(item.id);
											return next;
										});
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "eo_headText",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "eo_name",
										children: item.displayName
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "eo_description",
										children: [
											item.origin,
											item.baseHost === void 0 ? "" : ` · ${t("host")} ${item.baseHost}`,
											item.model === void 0 ? "" : ` · ${item.model}`,
											` · ${item.kind}`
										]
									})]
								}),
								item.imported === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "eo_badge",
									children: t("imported")
								}) : item.importable ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "eo_badge",
									children: t("notImported")
								})
							]
						}) }, item.id);
					})
				})]
			})
		]
	});
}
//#endregion
//#region src/client/locales.ts
const en = {
	nav: "Everything OAuth",
	title: "Everything OAuth",
	intro: "Import local logins, then enable only the models you want in the picker.",
	tabConfig: "Imported",
	tabSources: "Sources",
	scan: "Rescan",
	importSelected: "Import selected",
	selectImportable: "Select all importable",
	clearSelection: "Clear",
	imported: "Imported",
	notImported: "Unavailable",
	logout: "Remove",
	logoutAll: "Remove all",
	working: "Working…",
	none: "No local sources found.",
	noneImported: "Nothing imported yet. Open Sources to pick what to import.",
	requestFailed: "The request failed.",
	hint: "Only enabled models appear in the composer.",
	host: "endpoint",
	enableAll: "Enable all",
	enableNone: "Disable all",
	noModels: "No models listed for this source.",
	expand: "Expand",
	collapse: "Collapse",
	enabledCount: "{n} enabled"
};
const zh = {
	nav: "Everything OAuth",
	title: "Everything OAuth",
	intro: "先导入本机登录态，再勾选要出现在模型选择器里的模型。未导入、未启用的不会出现。",
	tabConfig: "导入配置",
	tabSources: "来源列表",
	scan: "重新扫描",
	importSelected: "导入勾选",
	selectImportable: "全选可导入",
	clearSelection: "取消勾选",
	imported: "已导入",
	notImported: "无法导入",
	logout: "移除",
	logoutAll: "全部移除",
	working: "处理中…",
	none: "没有扫到本机来源。",
	noneImported: "还没有导入。切到「来源列表」勾选要接入的登录态。",
	requestFailed: "请求失败。",
	hint: "只有勾选启用的模型会出现在对话的模型选择器。",
	host: "端点",
	enableAll: "全部启用",
	enableNone: "全部关闭",
	noModels: "这个来源还没有模型列表。",
	expand: "展开",
	collapse: "收起",
	enabledCount: "已启用 {n} 个"
};
//#endregion
//#region src/client/index.tsx
const name = "dsh-everything-oauth-client";
const inject = ["slots", "locale"];
function apply(ctx) {
	const namespace = "settings.everything-oauth";
	ctx.effect(() => ctx.locale.register(namespace, {
		zh,
		en
	}), "dsh-everything-oauth: settings copy");
	const t = ctx.locale.bind(namespace);
	ctx.slots.inject("settings.section", () => ctx.slots.register({
		name: "settings.section",
		id: "everything-oauth",
		order: 15,
		label: () => t("nav"),
		inject: () => ({ t })
	}, EverythingSettings));
}
//#endregion
exports.apply = apply;
exports.inject = inject;
exports.name = name;

		return module.exports;
	}
});
