export type Framework = 'react' | 'vue' | 'solid' | 'svelte'

/** Canonical framework order used across discovery, build, and reporting. */
export const ALL_FRAMEWORKS: Framework[] = ['react', 'vue', 'solid', 'svelte']

export type ComponentGroup =
  | 'primitives'
  | 'layouts'
  | 'skeletons'
  | 'behaviors'
  | 'form'
  | 'theme'
  | 'floating'
  | 'modal-utils'
  | 'plugin'
  | 'other'

/** A single component prop extracted from its `Iris<Name>Props` interface. */
export interface ManifestProp {
  name: string
  /** The declared TypeScript type (as written in source). */
  type: string
  /** Whether the prop is optional (`?`). */
  optional: boolean
  /** The prop's JSDoc summary, if any. */
  description?: string
}

/** Raw record produced by the filesystem discovery pass. */
export interface RawComponent {
  name: string
  group: ComponentGroup
  module?: string
  frameworks: Framework[]
  /** Owning plugin package (e.g. `@iris-ui/plugin-editor`) for plugin components. */
  plugin?: string
  /** Props extracted from the component's `Iris<Name>Props` interface (React source). */
  props?: ManifestProp[]
}

export interface RawTokens {
  color: string[]
  spacing: string[]
  radii: string[]
}

export interface RawDiscovery {
  components: RawComponent[]
  tokens: RawTokens
}

export interface ManifestComponent {
  name: string
  group: ComponentGroup
  /** For `primitives`, the owning sub-module directory (e.g. `button`). */
  module?: string
  frameworks: Framework[]
  /** Import specifier per framework the component is available in. */
  importFrom: Partial<Record<Framework, string>>
  /**
   * Owning plugin package (e.g. `@iris-ui/plugin-editor`) for plugin components.
   * Such components require `<IrisProvider plugins={[…]}>` activation and are
   * imported from the plugin's per-framework sub-path, not the core adapter.
   */
  plugin?: string
  /**
   * The component's typed prop contract (name / type / optional / JSDoc),
   * extracted from its `Iris<Name>Props` interface in the React source — so an
   * agent can call the component correctly without guessing. Absent when no
   * interface was found.
   */
  props?: ManifestProp[]
}

export interface ManifestGroupSummary {
  group: ComponentGroup
  count: number
  components: string[]
}

export interface ManifestLayer {
  layer: string
  description: string
}

export interface IrisManifest {
  /** Schema identifier + version, so consumers can detect format changes. */
  schema: string
  name: string
  description: string
  frameworks: Framework[]
  layerModel: ManifestLayer[]
  groups: ManifestGroupSummary[]
  components: ManifestComponent[]
  tokens: RawTokens & { all: string[] }
  stats: {
    total: number
    /** Components available in every framework (full parity). */
    full: number
    /** Component count per framework. */
    byFramework: Record<Framework, number>
  }
}
