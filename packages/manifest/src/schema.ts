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
  /**
   * The allowed string-literal values when the type is (or resolves through a
   * type alias to) a union of string literals — e.g. `variant` →
   * `['solid','outline','ghost','link']`. Lets an agent pick a valid value
   * without opening the source. Absent for non-enumerable types.
   */
  enum?: string[]
  /**
   * The prop's default value as written, when the component destructures a
   * literal default (e.g. `size = 'md'` → `'md'`, `disabled = false` → `false`).
   * Lets an agent omit props it would only re-set to the default. Absent when
   * there is no literal default.
   */
  default?: string
}

/** Raw record produced by the filesystem discovery pass. */
export interface RawComponent {
  name: string
  group: ComponentGroup
  module?: string
  frameworks: Framework[]
  /** Owning plugin package (e.g. `@iris-ui/plugin-editor`) for plugin components. */
  plugin?: string
  /** Prose summary harvested from the component's leading JSDoc (React source). */
  description?: string
  /** Usage snippet harvested from the component's JSDoc `@example`, if present. */
  example?: string
  /** Props extracted from the component's `Iris<Name>Props` interface (React source). */
  props?: ManifestProp[]
  /**
   * Event-handler prop names (`on[A-Z]` pattern) classified from `props`.
   * Populated by the discovery pass when props are available.
   */
  events?: string[]
  /**
   * Renderable content prop names (`'default'` for `children`, prop name for
   * named render-slots) classified from `props`.
   * Populated by the discovery pass when props are available.
   */
  slots?: string[]
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
  /**
   * Prose summary of what the component is/does, harvested from the first
   * paragraph of the leading JSDoc block above its exported symbol in the React
   * reference source (the four adapters share semantics). Lets an agent
   * understand a component's purpose without opening the source. Absent when the
   * component has no leading JSDoc — never fabricated.
   */
  description?: string
  /**
   * A usage snippet harvested from the component's JSDoc `@example` tag, when
   * present. Absent when the component has no `@example`.
   */
  example?: string
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
  /**
   * Compound sub-components: the parts a composite expects as children — e.g.
   * `IrisDialog` → `['IrisDialogTrigger','IrisDialogContent','IrisDialogTitle',…]`.
   * Detected by the `Iris<Root><Part>` naming convention (Part ∈ a fixed set like
   * Trigger/Content/Item/Sub/…), so an agent knows the full set to import + nest.
   * Absent for standalone components.
   */
  subComponents?: string[]
  /**
   * Event-handler prop names declared in the component's props interface
   * (props whose name matches `/^on[A-Z]/`). Derived from `props`; surfaced
   * here so an agent can discover events without scanning the full props list.
   * Absent when no event handlers were found.
   */
  events?: string[]
  /**
   * Renderable content prop names — `'default'` for `children`, prop name for
   * named render-slots (e.g. `'trigger'`, `'header'`). Absent when none found.
   */
  slots?: string[]
  /** Quality badges: SSR safety, ...rest forwarding, contract coverage. */
  quality?: {
    restForwarding?: boolean
    hasContract?: boolean
    ssrSafe?: boolean
    propCount?: number
    eventCount?: number
  }
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
