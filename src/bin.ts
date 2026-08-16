#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import type { AuthEvent, AuthPrompt } from '@earendil-works/pi-ai'
import { officialById } from './ids.ts'
import { loginSession } from './auth.ts'
import { safeMessage } from './redact.ts'
import { DshAuthEveryingSession, authEveryingPath } from './session.ts'

function openBrowser(rawUrl: string): void {
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:') throw new Error(`refusing non-HTTPS URL from ${url.host}`)
  const command = process.platform === 'win32'
    ? { file: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url.href] }
    : process.platform === 'darwin'
      ? { file: 'open', args: [url.href] }
      : { file: 'xdg-open', args: [url.href] }
  const child = spawn(command.file, command.args, { detached: true, stdio: 'ignore', windowsHide: true })
  child.on('error', () => {})
  child.unref()
}

function notify(event: AuthEvent): void {
  if (event.type === 'auth_url') {
    process.stdout.write(`Open: ${event.url}\n`)
    openBrowser(event.url)
    return
  }
  if (event.type === 'device_code') {
    process.stdout.write(`Open: ${event.verificationUri}\n`)
    if (event.userCode.length > 0) process.stdout.write(`Code: ${event.userCode}\n`)
    openBrowser(event.verificationUri)
  }
}

function printHelp(): void {
  process.stdout.write([
    'Usage: dsh-auth-everying <status|import|login|logout> [id]',
    '',
    '  status           list official platforms and discovered local keys (no secrets)',
    '  import <id...>   import only the source ids you pass',
    '  login <platform> optional OAuth for claude | codex | grok | copilot',
    '  logout [id]      forget stored credentials',
    '',
  ].join('\n'))
}

export async function run(argv: readonly string[]): Promise<number> {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    printHelp()
    return 0
  }
  const [action, id] = argv
  const session = new DshAuthEveryingSession()
  try {
    switch (action) {
      case 'status': {
        const status = await session.status()
        process.stdout.write(`store: ${authEveryingPath()}\n`)
        for (const platform of status.platforms) {
          process.stdout.write(`${platform.signedIn ? 'in ' : 'out'}  ${platform.displayName}  ${platform.route}\n`)
        }
        process.stdout.write('discovered:\n')
        for (const item of status.discovered) {
          process.stdout.write(`  ${item.importable ? 'yes' : 'no '}  ${item.id}  ${item.displayName}  ${item.origin}${item.baseHost === undefined ? '' : `  ${item.baseHost}`}\n`)
        }
        return 0
      }
      case 'import': {
        const ids = argv.slice(1)
        if (ids.length === 0) {
          process.stderr.write('dsh-auth-everying: pass source ids from status, e.g. import live:codex-auth\n')
          return 1
        }
        const imported = await session.importMany(ids)
        process.stdout.write(`imported ${imported.length} source(s)\n`)
        for (const item of imported) process.stdout.write(`  ${item.displayName} <- ${item.origin}\n`)
        process.stdout.write('Source files were not modified. Later refresh may rotate OAuth tokens.\n')
        return 0
      }
      case 'logout':
        await session.logout(id)
        process.stdout.write(`signed out ${id ?? 'all'}\n`)
        return 0
      case 'login': {
        const platform = id === undefined ? undefined : officialById(id)
        if (platform === undefined || !platform.canLogin) {
          process.stderr.write('dsh-auth-everying: login requires claude, codex, grok, or copilot\n')
          return 1
        }
        const readline = createInterface({ input: process.stdin, output: process.stdout })
        try {
          await loginSession(session, platform.id, {
            prompt: async (prompt: AuthPrompt) => {
              if (prompt.type === 'select') {
                return prompt.options.find(option => option.id.includes('oauth'))?.id ?? prompt.options[0]?.id ?? 'oauth'
              }
              return readline.question(`${prompt.message}: `)
            },
            notify,
          })
        } finally {
          readline.close()
        }
        process.stdout.write(`signed in ${platform.displayName}\n`)
        return 0
      }
      default:
        process.stderr.write(`dsh-auth-everying: unknown command ${JSON.stringify(action)}\n`)
        return 1
    }
  } catch (error: unknown) {
    process.stderr.write(`dsh-auth-everying: ${safeMessage(error)}\n`)
    return 1
  }
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  process.exitCode = await run(process.argv.slice(2))
}
