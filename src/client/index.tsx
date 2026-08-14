import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { EverythingSettings } from './Settings.tsx'
import type { SettingsInjected } from './Settings.tsx'
import { en, zh } from './locales.ts'
import type { EverythingOAuthKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.everything-oauth': EverythingOAuthKey
  }
}

export const name = 'dsh-everything-oauth-client'
export const inject = ['slots', 'locale']

export function apply(ctx: ClientContext): void {
  const namespace = 'settings.everything-oauth'
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'dsh-everything-oauth: settings copy')
  const t = ctx.locale.bind(namespace) as SettingsInjected['t']
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'everything-oauth',
    order: 15,
    label: () => t('nav'),
    inject: (): SettingsInjected => ({ t }),
  }, EverythingSettings))
}
