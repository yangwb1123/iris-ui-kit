import type { IrisIcon, IrisIconResolver, IrisIconSet } from './types'
import { defaultIcons } from './icons'

export interface IrisIconRegistry {
  /** Register (or replace) an icon set. The first registered set becomes active. */
  register(set: IrisIconSet): void
  /** Switch the active set by name. Throws if the name is not registered. */
  use(setName: string): void
  /** Apply per-icon overrides (semantic name → full icon definition). */
  setOverrides(overrides: Record<string, IrisIcon> | undefined): void
  /** Resolve an icon by name from the active set, honoring overrides. */
  resolve: IrisIconResolver
  /** Whether a name resolves to an icon. */
  has(name: string): boolean
  /** Names resolvable from the active set (excludes override-only names). */
  list(): string[]
  /** Look up a registered set by name (introspection for theme-driven resolution). */
  getSet(name: string): IrisIconSet | undefined
}

export interface CreateIconRegistryOptions {
  /** Icon sets to register up front. */
  sets?: IrisIconSet[]
  /**
   * Lean tree-shaking path: a flat list of individually-imported per-icon consts
   * (e.g. `[chevronDown, search]` from `@iris-ui-kit/icons`). They are bundled into a
   * single `'iris-lean'` set so a size-conscious consumer can build a minimal
   * registry from just the icons they import — without pulling the whole default
   * set. Registered AFTER `sets`, so when both are given `sets[0]` stays active.
   */
  icons?: IrisIcon[]
  /** The name of the set synthesized from `icons`. Default `'iris-lean'`. */
  iconsSetName?: string
  /** Active set name. Defaults to the first registered set. */
  active?: string
  /** Per-icon overrides — swap individual glyphs without registering a set. */
  overrides?: Record<string, IrisIcon>
}

/**
 * A mutable registry of icon sets with one active set and optional per-icon
 * overrides. Framework-agnostic: an adapter feeds it `IrisTheme.icons` (via
 * {@link IrisIconRegistry.use}) and resolved overrides (via
 * {@link IrisIconRegistry.setOverrides}); icons never imports the theme.
 */
export function createIconRegistry(options: CreateIconRegistryOptions = {}): IrisIconRegistry {
  const sets = new Map<string, IrisIconSet>()
  let activeName: string | undefined
  let overrides: Record<string, IrisIcon> = options.overrides ? { ...options.overrides } : {}

  for (const set of options.sets ?? []) {
    sets.set(set.name, set)
    if (activeName === undefined) activeName = set.name
  }
  // Synthesize a set from a flat list of per-icon consts (the lean import path).
  if (options.icons && options.icons.length > 0) {
    const leanSet: IrisIconSet = {
      name: options.iconsSetName ?? 'iris-lean',
      icons: Object.fromEntries(options.icons.map((icon) => [icon.name, icon])),
    }
    sets.set(leanSet.name, leanSet)
    if (activeName === undefined) activeName = leanSet.name
  }
  if (options.active !== undefined) activeName = options.active

  const activeSet = (): IrisIconSet | undefined =>
    activeName !== undefined ? sets.get(activeName) : undefined

  const resolve: IrisIconResolver = (name) => overrides[name] ?? activeSet()?.icons[name]

  return {
    register(set) {
      sets.set(set.name, set)
      if (activeName === undefined) activeName = set.name
    },
    use(setName) {
      if (!sets.has(setName)) {
        throw new Error(`[iris-ui] icon set "${setName}" is not registered`)
      }
      activeName = setName
    },
    setOverrides(next) {
      overrides = next ? { ...next } : {}
    },
    resolve,
    has: (name) => resolve(name) !== undefined,
    list: () => Object.keys(activeSet()?.icons ?? {}),
    getSet: (name) => sets.get(name),
  }
}

/**
 * Ready-to-use registry preloaded with {@link defaultIcons}. The
 * `/*@__PURE__*\/` annotation lets bundlers drop it (and its `defaultIcons`
 * dependency) when a consumer imports per-icon consts from the barrel without
 * touching the default registry — preserving the per-icon tree-shake win.
 */
export const defaultIconRegistry: IrisIconRegistry = /*@__PURE__*/ createIconRegistry({
  sets: [defaultIcons],
})

/** Resolve a name against the default registry. */
export const resolveIcon: IrisIconResolver = (name): IrisIcon | undefined =>
  defaultIconRegistry.resolve(name)
