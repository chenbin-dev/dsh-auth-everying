import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { EverythingOAuthKey } from './locales.ts'

const STATUS = '/plugins/dsh-everything-oauth/auth/status'
const IMPORT = '/plugins/dsh-everything-oauth/auth/import'
const MODELS = '/plugins/dsh-everything-oauth/auth/models'
const LOGOUT = '/plugins/dsh-everything-oauth/auth/logout'
const CSS_ID = 'dsh-everything-oauth/settings.css'

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
`

function ensureCss(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(CSS_ID)}]`)) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-everything-oauth'
  tag.dataset.pluginCss = CSS_ID
  tag.textContent = css
  document.head.appendChild(tag)
}

interface PlatformStatus {
  id: string
  route: string
  displayName: string
  origin?: string
  available: string[]
  enabled: string[]
}

interface DiscoveredSource {
  id: string
  displayName: string
  origin: string
  kind: 'oauth' | 'api_key'
  importable: boolean
  imported?: boolean
  baseHost?: string
  model?: string
}

interface StatusPayload {
  platforms: PlatformStatus[]
  discovered: DiscoveredSource[]
}

export interface SettingsInjected {
  t: (key: EverythingOAuthKey, params?: Record<string, unknown>) => string
}

type TabId = 'config' | 'sources'

async function jsonRequest<T>(path: string, method = 'GET', payload?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { accept: 'application/json', ...payload === undefined ? {} : { 'content-type': 'application/json' } },
    ...payload === undefined ? {} : { body: JSON.stringify(payload) },
  })
  const value: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const message = typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
      ? value.error
      : `HTTP ${response.status}`
    throw new Error(message)
  }
  return value as T
}

const chevron: CSSProperties = { width: 16, height: 16, display: 'block' }

export function EverythingSettings({ t }: Partial<SettingsInjected>) {
  if (t === undefined) throw new Error('Everything OAuth settings requires t')
  ensureCss()
  const tabsId = useId()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [tab, setTab] = useState<TabId>('config')
  const [openRoute, setOpenRoute] = useState<string>()
  const [status, setStatus] = useState<StatusPayload | undefined>()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<string>()
  const [busy, setBusy] = useState(false)
  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'config', label: t('tabConfig') },
    { id: 'sources', label: t('tabSources') },
  ]

  const refresh = useCallback(async () => {
    setStatus(await jsonRequest<StatusPayload>(STATUS))
  }, [])

  useEffect(() => {
    void refresh().catch((err: unknown) => {
      setMessage(err instanceof Error ? err.message : t('requestFailed'))
    })
  }, [refresh, t])

  const run = async (work: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setMessage(undefined)
    try {
      await work()
      await refresh()
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : t('requestFailed'))
    } finally {
      setBusy(false)
    }
  }

  const importable = (status?.discovered ?? []).filter(item => item.importable && item.imported !== true)

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else return
    event.preventDefault()
    const nextTab = tabs[next]
    if (nextTab === undefined) return
    setTab(nextTab.id)
    tabRefs.current[next]?.focus()
  }

  return (
    <section className="eo_section">
      <h2 className="eo_heading">{t('title')}</h2>
      <p className="eo_intro">{t('intro')}</p>
      {message === undefined ? null : <p className="eo_error">{message}</p>}
      <div className="eo_tabs" role="tablist" aria-label={t('title')}>
        {tabs.map((item, index) => {
          const active = item.id === tab
          return (
            <button
              key={item.id}
              ref={element => { tabRefs.current[index] = element }}
              id={`${tabsId}-tab-${item.id}`}
              type="button"
              role="tab"
              className="eo_tab"
              aria-selected={active}
              aria-controls={`${tabsId}-panel-${item.id}`}
              data-active={active ? 'true' : undefined}
              tabIndex={active ? 0 : -1}
              onClick={() => { setTab(item.id) }}
              onKeyDown={event => { onTabKey(event, index) }}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div id={`${tabsId}-panel-config`} className="eo_panel" role="tabpanel" aria-labelledby={`${tabsId}-tab-config`} hidden={tab !== 'config'}>
        <div className="eo_toolbar">
          <p className="eo_hint">{t('hint')}</p>
          {(status?.platforms ?? []).length > 0
            ? <button type="button" className="eo_btn" disabled={busy} onClick={() => { void run(async () => { await jsonRequest(LOGOUT, 'POST', {}) }) }}>{t('logoutAll')}</button>
            : null}
        </div>
        {(status?.platforms ?? []).length === 0 ? <p className="eo_empty">{t('noneImported')}</p> : (
          <ul className="eo_cards">
            {(status?.platforms ?? []).map(platform => {
              const open = openRoute === platform.route
              return (
                <li key={platform.route} className={open ? 'eo_card eo_cardOpen' : 'eo_card'}>
                  <button
                    type="button"
                    className="eo_header"
                    aria-expanded={open}
                    aria-label={`${t(open ? 'collapse' : 'expand')}: ${platform.displayName}`}
                    onClick={() => { setOpenRoute(open ? undefined : platform.route) }}
                  >
                    <span className="eo_headText">
                      <span className="eo_name">{platform.displayName}</span>
                      <span className="eo_description">
                        {platform.route}
                        {platform.origin === undefined ? '' : ` · ${platform.origin}`}
                      </span>
                    </span>
                    <span className="eo_badge">{t('enabledCount').replace('{n}', String(platform.enabled.length))}</span>
                    <svg className={open ? 'eo_chevron eo_chevronOpen' : 'eo_chevron'} style={chevron} viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {open
                    ? (
                        <div className="eo_body">
                          {platform.available.length === 0 ? <p className="eo_empty">{t('noModels')}</p> : (
                            <ul className="eo_models">
                              {platform.available.map(id => {
                                const on = platform.enabled.includes(id)
                                return (
                                  <li key={id}>
                                    <label className="eo_check">
                                      <input
                                        type="checkbox"
                                        checked={on}
                                        disabled={busy}
                                        onChange={() => {
                                          const next = new Set(platform.enabled)
                                          if (on) next.delete(id)
                                          else next.add(id)
                                          void run(async () => {
                                            await jsonRequest(MODELS, 'POST', { route: platform.route, enabled: [...next] })
                                          })
                                        }}
                                      />
                                      <span className="eo_mono">{id}</span>
                                    </label>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                          <div className="eo_footer">
                            <button type="button" className="eo_btn" disabled={busy} onClick={() => { void run(async () => { await jsonRequest(MODELS, 'POST', { route: platform.route, enabled: platform.available }) }) }}>{t('enableAll')}</button>
                            <button type="button" className="eo_btn" disabled={busy} onClick={() => { void run(async () => { await jsonRequest(MODELS, 'POST', { route: platform.route, enabled: [] }) }) }}>{t('enableNone')}</button>
                            <button type="button" className="eo_btn" disabled={busy} onClick={() => { void run(async () => { await jsonRequest(LOGOUT, 'POST', { id: platform.route }) }) }}>{t('logout')}</button>
                          </div>
                        </div>
                      )
                    : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div id={`${tabsId}-panel-sources`} className="eo_panel" role="tabpanel" aria-labelledby={`${tabsId}-tab-sources`} hidden={tab !== 'sources'}>
        <div className="eo_toolbar">
          <button
            type="button"
            className="eo_primary"
            disabled={busy || selected.size === 0}
            onClick={() => {
              void run(async () => {
                await jsonRequest(IMPORT, 'POST', { ids: [...selected] })
                setSelected(new Set())
                setTab('config')
              })
            }}
          >
            {busy ? t('working') : `${t('importSelected')} (${selected.size})`}
          </button>
          <button type="button" className="eo_btn" disabled={busy || importable.length === 0} onClick={() => { setSelected(new Set(importable.map(item => item.id))) }}>{t('selectImportable')}</button>
          <button type="button" className="eo_btn" disabled={busy} onClick={() => { setSelected(new Set()) }}>{t('clearSelection')}</button>
          <button type="button" className="eo_btn" disabled={busy} onClick={() => { void run(async () => { await refresh() }) }}>{t('scan')}</button>
        </div>
        {(status?.discovered ?? []).length === 0 ? <p className="eo_empty">{t('none')}</p> : (
          <ul className="eo_cards">
            {(status?.discovered ?? []).map(item => {
              const locked = !item.importable || item.imported === true
              return (
                <li key={item.id}>
                  <label className="eo_source">
                    <input
                      type="checkbox"
                      disabled={locked || busy}
                      checked={item.imported === true || selected.has(item.id)}
                      onChange={event => {
                        setSelected(current => {
                          const next = new Set(current)
                          if (event.target.checked) next.add(item.id)
                          else next.delete(item.id)
                          return next
                        })
                      }}
                    />
                    <span className="eo_headText">
                      <span className="eo_name">{item.displayName}</span>
                      <span className="eo_description">
                        {item.origin}
                        {item.baseHost === undefined ? '' : ` · ${t('host')} ${item.baseHost}`}
                        {item.model === undefined ? '' : ` · ${item.model}`}
                        {` · ${item.kind}`}
                      </span>
                    </span>
                    {item.imported === true
                      ? <span className="eo_badge">{t('imported')}</span>
                      : item.importable
                        ? null
                        : <span className="eo_badge">{t('notImported')}</span>}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
