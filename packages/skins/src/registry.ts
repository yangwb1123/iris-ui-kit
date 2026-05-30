import type { Skin, ResolvedSkin } from './types'
import { validateSkin } from './validateSkin'
import { resolveSkin } from './resolveSkin'
import { skinError, SkinResolutionError, type SkinError } from './errors'

export interface SkinRegistry {
  /** Validate then register (only if valid). Returns validation errors (empty = registered). */
  register(skin: Skin): SkinError[]
  get(id: string): Skin | undefined
  has(id: string): boolean
  list(): Skin[]
  remove(id: string): boolean
  /** Resolve a registered skin's extends-chain. Throws `SkinResolutionError` if absent/invalid. */
  resolve(id: string): ResolvedSkin
}

export function createSkinRegistry(initial: Skin[] = []): SkinRegistry {
  const map = new Map<string, Skin>()
  const registry: SkinRegistry = {
    register(skin) {
      const errors = validateSkin(skin)
      if (errors.length === 0) map.set(skin.id, skin)
      return errors
    },
    get: (id) => map.get(id),
    has: (id) => map.has(id),
    list: () => [...map.values()],
    remove: (id) => map.delete(id),
    resolve(id) {
      const skin = map.get(id)
      if (!skin) {
        throw new SkinResolutionError(skinError('missing-parent', `unknown skin "${id}"`, { id }))
      }
      return resolveSkin(skin, registry)
    },
  }
  for (const s of initial) registry.register(s)
  return registry
}
