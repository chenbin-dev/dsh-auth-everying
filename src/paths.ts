import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export function home(...parts: string[]): string {
  return resolve(join(homedir(), ...parts))
}

export const LIVE_PATHS = {
  claudeSettings: home('.claude', 'settings.json'),
  claudeLocalSettings: home('.claude', 'settings.local.json'),
  claudeJson: home('.claude.json'),
  claudeCredentials: home('.claude', '.credentials.json'),
  codexAuth: home('.codex', 'auth.json'),
  codexConfig: home('.codex', 'config.toml'),
  grokAuth: home('.grok', 'auth.json'),
  grokConfig: home('.grok', 'config.toml'),
  geminiEnv: home('.gemini', '.env'),
  geminiOauth: home('.gemini', 'oauth_creds.json'),
  geminiConfigEnv: home('.config', 'gemini', '.env'),
  opencodeJson: home('.config', 'opencode', 'opencode.json'),
  opencodeAuth: home('.local', 'share', 'opencode', 'auth.json'),
  opencodeAccount: home('.local', 'share', 'opencode', 'account.json'),
  copilotHosts: home('.config', 'github-copilot', 'hosts.json'),
  copilotApps: home('.config', 'github-copilot', 'apps.json'),
  openclaw: home('.openclaw', 'openclaw.json'),
  ccSwitchDb: home('.cc-switch', 'cc-switch.db'),
  ccSwitchSettings: home('.cc-switch', 'settings.json'),
} as const

export const CLAUDE_KEYCHAIN_SERVICES = ['Claude Code-credentials', 'Claude Code'] as const
