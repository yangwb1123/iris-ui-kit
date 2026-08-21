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

interface SkinEngineState {
  config: SkinEngineConfig
  registry: SkinRegistry
  storage?: SkinStorage
  catalog?: SkinCatalog
  mode: SkinMode
  activeId: string
  patchOverlay: SkinPatch | null
  stopWatch: (() => void) | null
  errorLog: SkinError[]
  store: Store<ResolvedSkin>
}

function recordSkinError(state: SkinEngineState, error: unknown): void {
  if (error instanceof SkinResolutionError) state.errorLog.push(error.error)
  else state.errorLog.push(skinError('validate', String(error)))
}

function applySkinOverlay(state: SkinEngineState, base: ResolvedSkin): ResolvedSkin {
  const patch = state.patchOverlay
  if (!patch || (!patch.tokens && !patch.custom)) return base
  const theme = {
    ...base.theme,
    colors: { ...base.theme.colors },
    spacing: { ...base.theme.spacing },
    radii: { ...base.theme.radii },
  }
  if (patch.tokens) {
    for (const [key, value] of Object.entries(patch.tokens)) {
      if (key in theme.colors && typeof value === 'string') {
        ;(theme.colors as Record<string, string>)[key] = value
      } else if (key in theme.spacing && typeof value === 'number') {
        ;(theme.spacing as Record<string, number>)[key] = value
      } else if (key in theme.radii && typeof value === 'number') {
        ;(theme.radii as Record<string, number>)[key] = value
      }
    }
  }
  return { ...base, theme, custom: { ...base.custom, ...(patch.custom ?? {}) } }
}

function remapSkinId(state: SkinEngineState, id: string): string {
  if (state.mode !== 'system') return id
  const scheme = getColorScheme()
  const variants = state.registry.get(id)?.variants
  if (variants) return scheme === 'dark' ? (variants.dark ?? id) : (variants.light ?? id)
  return scheme === 'dark' ? 'dark' : 'light'
}

/** Resolve id, applying system-variant remap + live-edit overlay; fall back safely. */
function computeSkin(state: SkinEngineState, id: string): ResolvedSkin {
  const target = remapSkinId(state, id)
  try {
    return applySkinOverlay(state, state.registry.resolve(target))
  } catch (error) {
    recordSkinError(state, error)
    try {
      return applySkinOverlay(state, state.registry.resolve(state.config.default))
    } catch (fallbackError) {
      recordSkinError(state, fallbackError)
      return applySkinOverlay(state, state.registry.resolve('light'))
    }
  }
}

function commitSkin(state: SkinEngineState, id: string): void {
  state.activeId = id
  state.store.setState(computeSkin(state, id))
}

function refreshSkin(state: SkinEngineState): void {
  state.store.setState(computeSkin(state, state.activeId))
}

function startSkinWatch(state: SkinEngineState): void {
  if (state.stopWatch) return
  state.stopWatch = watchColorScheme(() => refreshSkin(state))
}

function endSkinWatch(state: SkinEngineState): void {
  state.stopWatch?.()
  state.stopWatch = null
}

function registerSkin(state: SkinEngineState, skin: Skin): ResolvedSkin {
  const errors = state.registry.register(skin)
  if (errors.length) {
    state.errorLog.push(...errors)
    throw new SkinResolutionError(errors[0])
  }
  state.storage?.set(skin.id)
  commitSkin(state, skin.id)
  return state.store.getState()
}

async function loadSkinIntoEngine(
  state: SkinEngineState,
  source: string | Skin,
): Promise<ResolvedSkin> {
  try {
    return registerSkin(state, await loadSkinSource(source))
  } catch (error) {
    recordSkinError(state, error)
    throw error
  }
}

async function loadCatalogSkinIntoEngine(
  state: SkinEngineState,
  id: string,
): Promise<ResolvedSkin> {
  if (!state.catalog) throw new SkinResolutionError(skinError('catalog', 'no catalog attached'))
  try {
    return registerSkin(state, await state.catalog.fetchSkin(id))
  } catch (error) {
    recordSkinError(state, error)
    throw error
  }
}

export function createSkinEngine(config: SkinEngineConfig): SkinEngine {
  const state = {
    config,
    registry: createSkinRegistry([...builtinSkins, ...(config.skins ?? [])]),
    storage: config.storage,
    catalog: config.catalog,
    mode: config.mode ?? 'fixed',
    activeId: config.storage?.get() ?? config.default,
    patchOverlay: null,
    stopWatch: null,
    errorLog: [],
  } as unknown as SkinEngineState
  state.store = createStore<ResolvedSkin>(computeSkin(state, state.activeId))
  if (state.mode === 'system') startSkinWatch(state)

  return {
    store: state.store,
    registry: state.registry,
    current: () => state.store.getState(),
    availableSkins: () => state.registry.list(),
    setSkin(id) {
      state.storage?.set(id)
      commitSkin(state, id)
    },
    loadSkin: (source) => loadSkinIntoEngine(state, source),
    useFromCatalog: (id) => loadCatalogSkinIntoEngine(state, id),
    attachCatalog: (catalog) => {
      state.catalog = catalog
    },
    setMode(next) {
      state.mode = next
      if (next === 'system') startSkinWatch(state)
      else endSkinWatch(state)
      refreshSkin(state)
    },
    getMode: () => state.mode,
    getActiveId: () => state.activeId,
    patch(overrides) {
      state.patchOverlay = {
        tokens: { ...(state.patchOverlay?.tokens ?? {}), ...(overrides.tokens ?? {}) },
        custom: { ...(state.patchOverlay?.custom ?? {}), ...(overrides.custom ?? {}) },
      }
      refreshSkin(state)
    },
    resetPatch() {
      state.patchOverlay = null
      refreshSkin(state)
    },
    subscribe: (listener) => state.store.subscribe(listener),
    destroy: () => endSkinWatch(state),
    errors: () => [...state.errorLog],
  }
}
