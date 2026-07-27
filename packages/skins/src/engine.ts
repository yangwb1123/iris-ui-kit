import { createStore, type Store } from '@iris-ui-kit/core'
import { watchColorScheme, getColorScheme } from '@iris-ui-kit/theme'
import type { Skin, ResolvedSkin, SkinMode, SkinStorage, SkinTokenOverrides } from './types'
import { createSkinRegistry, type SkinRegistry } from './registry'
import { builtinSkins } from './builtins'
import { loadSkin as loadSkinSource } from './loadSkin'
import type { SkinCatalog } from './catalog'
import { skinError, SkinResolutionError, type SkinError } from './errors'

export interface SkinEngineConfig {
  skins?: Skin[]
  /** Initial skin id (must resolve, or engine falls back to default then 'light'). */
  default: string
  catalog?: SkinCatalog
  storage?: SkinStorage
  mode?: SkinMode
}

export interface SkinPatch {
  tokens?: SkinTokenOverrides
  custom?: Record<string, string | number>
}

export interface SkinEngine {
  store: Store<ResolvedSkin>
  registry: SkinRegistry
  current(): ResolvedSkin
  availableSkins(): Skin[]
  setSkin(id: string): void
  loadSkin(source: string | Skin): Promise<ResolvedSkin>
  useFromCatalog(id: string): Promise<ResolvedSkin>
  attachCatalog(catalog: SkinCatalog): void
  setMode(mode: SkinMode): void
  getMode(): SkinMode
  /** The logical selected id (pre system-variant remap) — e.g. 'auto' while following the system. */
  getActiveId(): string
  patch(overrides: SkinPatch): void
  resetPatch(): void
  subscribe(listener: (skin: ResolvedSkin) => void): () => void
  destroy(): void
  errors(): SkinError[]
}

export function createSkinEngine(config: SkinEngineConfig): SkinEngine {
  const registry = createSkinRegistry([...builtinSkins, ...(config.skins ?? [])])
  const storage = config.storage
  let catalog = config.catalog
  let mode: SkinMode = config.mode ?? 'fixed'
  let activeId = storage?.get() ?? config.default
  let patchOverlay: SkinPatch | null = null
  let stopWatch: (() => void) | null = null
  const errorLog: SkinError[] = []

  function record(e: unknown): void {
    if (e instanceof SkinResolutionError) errorLog.push(e.error)
    else errorLog.push(skinError('validate', String(e)))
  }

  function applyOverlay(base: ResolvedSkin): ResolvedSkin {
    if (!patchOverlay || (!patchOverlay.tokens && !patchOverlay.custom)) return base
    const theme = {
      ...base.theme,
      colors: { ...base.theme.colors },
      spacing: { ...base.theme.spacing },
      radii: { ...base.theme.radii },
    }
    if (patchOverlay.tokens) {
      for (const [k, v] of Object.entries(patchOverlay.tokens)) {
        if (k in theme.colors && typeof v === 'string') {
          ;(theme.colors as Record<string, string>)[k] = v
        } else if (k in theme.spacing && typeof v === 'number') {
          ;(theme.spacing as Record<string, number>)[k] = v
        } else if (k in theme.radii && typeof v === 'number') {
          ;(theme.radii as Record<string, number>)[k] = v
        }
      }
    }
    const custom = { ...base.custom, ...(patchOverlay.custom ?? {}) }
    return { ...base, theme, custom }
  }

  function remapForMode(id: string): string {
    if (mode !== 'system') return id
    const scheme = getColorScheme()
    const variants = registry.get(id)?.variants
    if (variants) return scheme === 'dark' ? (variants.dark ?? id) : (variants.light ?? id)
    return scheme === 'dark' ? 'dark' : 'light'
  }

  /** Resolve id, applying system-variant remap + live-edit overlay; fall back safely. */
  function compute(id: string): ResolvedSkin {
    const target = remapForMode(id)
    try {
      return applyOverlay(registry.resolve(target))
    } catch (e) {
      record(e)
      try {
        return applyOverlay(registry.resolve(config.default))
      } catch (e2) {
        record(e2)
        return applyOverlay(registry.resolve('light'))
      }
    }
  }

  const store = createStore<ResolvedSkin>(compute(activeId))

  function commit(id: string): void {
    activeId = id
    store.setState(compute(id))
  }
  function refresh(): void {
    store.setState(compute(activeId))
  }
  function startWatch(): void {
    if (stopWatch) return
    stopWatch = watchColorScheme(() => refresh())
  }
  function endWatch(): void {
    stopWatch?.()
    stopWatch = null
  }
  if (mode === 'system') startWatch()

  const engine: SkinEngine = {
    store,
    registry,
    current: () => store.getState(),
    availableSkins: () => registry.list(),
    setSkin(id) {
      storage?.set(id)
      commit(id)
    },
    async loadSkin(source) {
      try {
        const skin = await loadSkinSource(source)
        const errs = registry.register(skin)
        if (errs.length) {
          errorLog.push(...errs)
          throw new SkinResolutionError(errs[0])
        }
        storage?.set(skin.id)
        commit(skin.id)
        return store.getState()
      } catch (e) {
        record(e)
        throw e
      }
    },
    async useFromCatalog(id) {
      if (!catalog) throw new SkinResolutionError(skinError('catalog', 'no catalog attached'))
      try {
        const skin = await catalog.fetchSkin(id)
        const errs = registry.register(skin)
        if (errs.length) {
          errorLog.push(...errs)
          throw new SkinResolutionError(errs[0])
        }
        storage?.set(skin.id)
        commit(skin.id)
        return store.getState()
      } catch (e) {
        record(e)
        throw e
      }
    },
    attachCatalog(c) {
      catalog = c
    },
    setMode(next) {
      mode = next
      if (next === 'system') startWatch()
      else endWatch()
      refresh()
    },
    getMode: () => mode,
    getActiveId: () => activeId,
    patch(overrides) {
      patchOverlay = {
        tokens: { ...(patchOverlay?.tokens ?? {}), ...(overrides.tokens ?? {}) },
        custom: { ...(patchOverlay?.custom ?? {}), ...(overrides.custom ?? {}) },
      }
      refresh()
    },
    resetPatch() {
      patchOverlay = null
      refresh()
    },
    subscribe: (l) => store.subscribe(l),
    destroy: () => endWatch(),
    errors: () => [...errorLog],
  }
  return engine
}
