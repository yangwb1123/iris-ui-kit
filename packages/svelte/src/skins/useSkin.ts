import { getContext } from 'svelte'
import type { Readable } from 'svelte/store'
import type { ResolvedSkin, Skin, SkinMode, SkinPatch, SkinError } from '@iris-ui-kit/skins'
import { SKIN_KEY, type IrisSkinContextValue } from './context'

export interface UseSkinReturn {
  /** Resolved skin as a Svelte store — use `$skin` in markup. */
  skin: Readable<ResolvedSkin>
  setSkin: (id: string) => void
  loadSkin: (source: string | Skin) => Promise<ResolvedSkin>
  useFromCatalog: (id: string) => Promise<ResolvedSkin>
  patch: (overrides: SkinPatch) => void
  resetPatch: () => void
  setMode: (mode: SkinMode) => void
  getMode: () => SkinMode
  /** Logical selected id (pre system-variant remap) — e.g. 'auto' while following the system. */
  getActiveId: () => string
  availableSkins: () => Skin[]
  errors: () => SkinError[]
}

export function useSkinContext(): IrisSkinContextValue {
  const ctx = getContext<IrisSkinContextValue | undefined>(SKIN_KEY)
  if (!ctx) throw new Error('[iris-ui] useSkin(): no <SkinProvider> ancestor found')
  return ctx
}

/** Non-throwing read for skin-aware primitives that may render standalone. */
export function useSkinOptional(): Readable<ResolvedSkin> | undefined {
  return getContext<IrisSkinContextValue | undefined>(SKIN_KEY)?.current
}

/** Read + control the active skin from anywhere inside a `<SkinProvider>`. */
export function useSkin(): UseSkinReturn {
  const { engine, current } = useSkinContext()
  return {
    skin: current,
    setSkin: engine.setSkin,
    loadSkin: engine.loadSkin,
    useFromCatalog: engine.useFromCatalog,
    patch: engine.patch,
    resetPatch: engine.resetPatch,
    setMode: engine.setMode,
    getMode: engine.getMode,
    getActiveId: engine.getActiveId,
    availableSkins: engine.availableSkins,
    errors: engine.errors,
  }
}
