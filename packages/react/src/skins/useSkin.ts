import type { ResolvedSkin, Skin, SkinMode, SkinPatch, SkinError } from '@iris-ui/skins'
import { useSkinContext } from './SkinProvider'

export interface UseSkinReturn {
  skin: ResolvedSkin
  setSkin: (id: string) => void
  loadSkin: (source: string | Skin) => Promise<ResolvedSkin>
  useFromCatalog: (id: string) => Promise<ResolvedSkin>
  patch: (overrides: SkinPatch) => void
  resetPatch: () => void
  setMode: (mode: SkinMode) => void
  availableSkins: () => Skin[]
  errors: () => SkinError[]
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
    availableSkins: engine.availableSkins,
    errors: engine.errors,
  }
}
