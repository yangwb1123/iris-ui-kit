import type {
  IrisTheme,
  IrisThemeType,
  IrisThemeColors,
  IrisThemeSpacing,
  IrisThemeRadii,
  IrisThemeShadows,
  IrisThemeZIndex,
  IrisThemeTransitions,
} from '@iris-ui-kit/tokens'

/** Partial overrides of the closed core token set. Omitted values inherit from parent skins. */
export type SkinTokenOverrides = Partial<
  IrisThemeColors &
    IrisThemeSpacing &
    IrisThemeRadii &
    IrisThemeShadows &
    IrisThemeZIndex &
    IrisThemeTransitions
>

/** Authoring shape: partial + composable. Resolves to a complete `ResolvedSkin`. */
export interface Skin {
  /** Stable unique id, e.g. "acme-dark". Used as registry key + catalog lookup. */
  id: string
  /** Human-facing display name. Falls back to `id` when omitted. */
  name?: string
  /** Semver-ish version string. Optional; the catalog may pin/range it. */
  version?: string
  /** Light/dark hint. If omitted, inherited from the parent chain, else 'light'. */
  type?: IrisThemeType
  /** Inheritance: a parent id or ordered list (later wins). Cycles are an error. */
  extends?: string | string[]
  /** Partial overrides of core theme tokens (omitted ones inherit from the chain). */
  tokens?: SkinTokenOverrides
  /** Free-form custom tokens beyond the closed schema (dot-notation key → string|number). */
  custom?: Record<string, string | number>
  /** Optional light/dark companions for system-follow. */
  variants?: { light?: string; dark?: string }
  /** Icon set name (pass-through to IrisTheme.icons). */
  icons?: string
  /** Per-icon alias (pass-through to IrisTheme.iconOverrides). */
  iconOverrides?: Record<string, string>
  /** Free-form catalog/display metadata. Not applied to the DOM. */
  meta?: Record<string, unknown>
}

/** Runtime shape: fully specified. `.theme` is a complete drop-in `IrisTheme`. */
export interface ResolvedSkin {
  id: string
  name: string
  type: IrisThemeType
  /** A complete, valid IrisTheme, including any resolved optional token sections. */
  theme: IrisTheme
  /** Fully-merged custom token map. */
  custom: Record<string, string | number>
  /** Resolution order, base → leaf. */
  lineage: string[]
  variants?: { light?: string; dark?: string }
  /** The original authoring Skin this resolved from (round-tripping / live-edit). */
  source: Skin
}

export interface SkinManifestEntry {
  id: string
  name?: string
  version?: string
  type?: IrisThemeType
  /** Where to fetch the full Skin JSON. Relative to the manifest URL or absolute. */
  url: string
  /** Optional inline metadata for discovery UIs (tags, author, preview). */
  meta?: Record<string, unknown>
}

export interface SkinManifest {
  /** Manifest schema version for forward-compat. */
  schema: 1
  skins: SkinManifestEntry[]
}

export type SkinMode = 'fixed' | 'system'

export interface SkinStorage {
  get(): string | null
  set(id: string): void
  remove(): void
}
