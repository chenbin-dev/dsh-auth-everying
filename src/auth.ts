import { createModels } from '@earendil-works/pi-ai'
import type { AuthInteraction } from '@earendil-works/pi-ai'
import { catalogProvider } from './providers.ts'
import { officialById, type OfficialPlatformId } from './ids.ts'
import { EverythingOAuthStore } from './store.ts'
import type { EverythingOAuthSession } from './session.ts'

export async function loginOfficial(
  id: OfficialPlatformId,
  interaction: AuthInteraction,
  store: EverythingOAuthStore = new EverythingOAuthStore(),
): Promise<void> {
  const platform = officialById(id)
  const provider = catalogProvider(id)
  if (platform === undefined || provider === undefined || !platform.canLogin) {
    throw new Error(`${id} does not support in-app OAuth`)
  }
  const models = createModels({ credentials: store })
  models.setProvider(provider)
  await models.login(platform.piProvider, 'oauth', interaction)
}

export async function loginSession(
  session: EverythingOAuthSession,
  id: OfficialPlatformId,
  interaction: AuthInteraction,
): Promise<void> {
  await loginOfficial(id, interaction, session.store)
}
