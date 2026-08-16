import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { DshAuthEveryingSettings } from './Settings.tsx'
import type { SettingsInjected } from './Settings.tsx'
import { en, zh } from './locales.ts'
import type { DshAuthEveryingKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.dsh-auth-everying': DshAuthEveryingKey
  }
}

export const name = 'dsh-auth-everying-client'
export const inject = ['slots', 'locale']

export function apply(ctx: ClientContext): void {
  const namespace = 'settings.dsh-auth-everying'
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'dsh-auth-everying: settings copy')
  const t = ctx.locale.bind(namespace) as SettingsInjected['t']
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-auth-everying',
    order: 15,
    label: () => t('nav'),
    inject: (): SettingsInjected => ({ t }),
  }, DshAuthEveryingSettings))
}
