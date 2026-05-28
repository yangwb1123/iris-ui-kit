export type Framework = 'react' | 'vue'

export type ComponentGroup =
  | 'primitives'
  | 'layouts'
  | 'skeletons'
  | 'behaviors'
  | 'form'
  | 'theme'
  | 'floating'
  | 'modal-utils'
  | 'other'

/** Raw record produced by the filesystem discovery pass. */
export interface RawComponent {
  name: string
  group: ComponentGroup
  module?: string
  frameworks: Framework[]
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
  stats: { total: number; both: number; reactOnly: number; vueOnly: number }
}
