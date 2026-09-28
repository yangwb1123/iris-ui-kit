export type Framework = 'react' | 'vue' | 'solid' | 'svelte'

/** Canonical framework order used across discovery, build, and reporting. */
export const ALL_FRAMEWORKS: Framework[] = ['react', 'vue', 'solid', 'svelte']

export type ComponentLayer =
  'layer-0' | 'layer-1' | 'layer-2' | 'layer-3' | 'layer-4' | 'behavior' | 'plugin'

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

/** A single component prop extracted from its native `Iris<Name>Props` declaration. */
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

/**
 * The public calling contract as authored by one framework adapter.
 *
 * Contracts are intentionally per-framework: Vue's `modelValue` /
 * `update:modelValue`, Solid's `onChange`, and Svelte callback props are not
 * represented as if they were React props. `source: native` means the fields
 * were extracted from that adapter's own source.
 */
export interface ManifestFrameworkContract {
  source: 'native' | 'unavailable' | 'legacy-react-fallback'
  props: ManifestProp[]
  events: string[]
  slots: string[]
  /** Public `Iris<Name>*` type exports reachable from that adapter's barrels. */
  publicTypes: string[]
  /**
   * How `props` was obtained.
   *
   * - `declared` (default) — enumerated from a props `interface`, an object
   *   literal, or references to other `Iris*Props` types.
   * - `intrinsic-spread` — the props type is a bare reference to the
   *   framework's own attribute set (`React.HTMLAttributes<HTMLSpanElement>`,
   *   `JSX.HTMLAttributes<…>`, …) with no enumerable members. `props` is
   *   therefore empty, but the component still forwards that whole attribute
   *   set at runtime. An empty `props` array means "nothing extractable", not
   *   "accepts nothing" — see `intrinsicAttributes` for the actual surface.
   */
  propsSource?: 'declared' | 'intrinsic-spread'
  /**
   * The intrinsic attribute type the component forwards, verbatim from source
   * (e.g. `React.HTMLAttributes<HTMLSpanElement>`). Present only when
   * `propsSource === 'intrinsic-spread'`, so a consumer can tell the real
   * surface instead of inferring "no props" from an empty array.
   */
  intrinsicAttributes?: string
}

/** Raw record produced by the filesystem discovery pass. */
export interface RawComponent {
  name: string
  group: ComponentGroup
  module?: string
  frameworks: Framework[]
  /** Owning plugin package (e.g. `@iris-ui-kit/plugin-editor`) for plugin components. */
  plugin?: string
  /** Prose summary harvested from the component's leading JSDoc (React source). */
  description?: string
  /** Usage snippet harvested from the component's JSDoc `@example`, if present. */
  example?: string
  /** Props extracted from the component's `Iris<Name>Props` interface/type alias (React source). */
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
  /** Native public contract for every adapter in `frameworks`. */
  frameworkContracts?: Partial<Record<Framework, ManifestFrameworkContract>>
}

export interface RawTokens {
  color: string[]
  spacing: string[]
  radii: string[]
  shadows: string[]
  zIndex: string[]
  transitions: string[]
}

export interface RawDiscovery {
  components: RawComponent[]
  tokens: RawTokens
}

export interface ManifestComponent {
  name: string
  group: ComponentGroup
  /** Stable architecture layer assigned by the central layer classifier. */
  layer: ComponentLayer
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
   * Owning plugin package (e.g. `@iris-ui-kit/plugin-editor`) for plugin components.
   * Such components require `<IrisProvider plugins={[…]}>` activation and are
   * imported from the plugin's per-framework sub-path, not the core adapter.
   */
  plugin?: string
  /**
   * The component's typed prop contract (name / type / optional / JSDoc),
   * extracted from its `Iris<Name>Props` interface/type alias in the React source — so an
   * agent can call the component correctly without guessing. Absent when no
   * interface was found.
   */
  props?: ManifestProp[]
  /**
   * Native per-adapter contracts. This is the authoritative calling surface for
   * framework-targeted tooling. The legacy top-level `props` / `events` /
   * `slots` fields remain for schema-v1 consumers and describe React only.
   */
  frameworkContracts?: Partial<Record<Framework, ManifestFrameworkContract>>
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
  /**
   * Cross-framework prop-name overlap for this component, plus the
   * largest/smallest prop-count spread. Present only when the component has a
   * native contract in every framework. See `parity.ts` for why this is a
   * visibility metric and not a pass/fail guarantee.
   */
  parity?: import('./parity').ComponentParity
}

export interface ManifestGroupSummary {
  group: ComponentGroup
  count: number
  components: string[]
}

export interface ManifestLayer {
  id: ComponentLayer
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
    /**
     * Cross-framework prop-surface accounting. `byFramework` answers "does each
     * adapter export it?"; this answers "do the adapters expose the same
     * surface?". Absent only on legacy manifests built before this field.
     */
    parity?: import('./parity').ParitySummary
  }
}

/**
 * Resolve the contract tooling should use for a target framework.
 *
 * The fallback keeps old schema-v1 manifests consumable. New manifests always
 * carry native contracts, so a React contract is never silently presented as
 * another adapter's contract.
 */
export function getFrameworkContract(
  component: ManifestComponent,
  framework: Framework,
): ManifestFrameworkContract {
  const native = component.frameworkContracts?.[framework]
  if (native) return native
  return {
    source: 'legacy-react-fallback',
    props: component.props ?? [],
    events: component.events ?? [],
    slots: component.slots ?? [],
    publicTypes: [],
  }
}
