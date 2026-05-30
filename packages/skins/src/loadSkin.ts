import type { Skin } from './types'
import { validateSkin } from './validateSkin'
import { skinError, SkinResolutionError } from './errors'

export interface LoadSkinOptions {
  fetch?: typeof fetch
}

function resolveFetch(injected?: typeof fetch): typeof fetch {
  if (injected) return injected
  if (typeof fetch !== 'undefined') return fetch
  throw new SkinResolutionError(skinError('load', 'no fetch available to load a skin'))
}

/** Load a skin from a URL (fetch+parse) or an inline object, validating before returning. */
export async function loadSkin(source: string | Skin, opts: LoadSkinOptions = {}): Promise<Skin> {
  let skin: Skin
  if (typeof source === 'string') {
    const f = resolveFetch(opts.fetch)
    const res = await f(source)
    if (!res.ok) {
      throw new SkinResolutionError(skinError('load', `failed to fetch skin: ${res.status}`))
    }
    skin = (await res.json()) as Skin
  } else {
    skin = source
  }
  const errors = validateSkin(skin)
  if (errors.length > 0) {
    throw new SkinResolutionError(
      skinError('load', `invalid skin: ${errors.map((e) => e.message).join('; ')}`, {
        id: skin?.id,
        keys: errors.flatMap((e) => e.keys ?? []),
      }),
    )
  }
  return skin
}
