import type { RuntimeRegistryPayload } from '@iris-ui-kit/registry'
import { validateSkin, type Skin, type SkinEngine } from '@iris-ui-kit/skins'
import { installFont, type FontInstallerConfig } from './font'
import type { IrisFontResource, RuntimeResourceInstaller } from './types'

export interface SkinInstallerOptions {
  activate?: boolean
}

export function createSkinResourceInstaller(
  engine: SkinEngine,
  options: SkinInstallerOptions = {},
): RuntimeResourceInstaller {
  return (payload: RuntimeRegistryPayload) => {
    if (payload.type !== 'iris:skin') throw new Error('Expected a skin payload')
    const skin = payload.data as Skin
    const errors = validateSkin(skin)
    if (errors.length > 0) {
      throw new Error(
        `Invalid skin resource\n- ${errors.map((error) => error.message).join('\n- ')}`,
      )
    }
    const previous = engine.registry.get(skin.id)
    const registered = engine.registry.register(skin)
    if (registered.length > 0) throw new Error('Unable to register skin resource')
    if (options.activate) engine.setSkin(skin.id)
    return () => {
      engine.registry.remove(skin.id)
      if (previous) engine.registry.register(previous)
    }
  }
}

export function createFontResourceInstaller(
  config: FontInstallerConfig = {},
): RuntimeResourceInstaller {
  return async (payload: RuntimeRegistryPayload) => {
    if (payload.type !== 'iris:font') throw new Error('Expected a font payload')
    const installed = await installFont(payload.data as IrisFontResource, config)
    return installed.revert
  }
}
