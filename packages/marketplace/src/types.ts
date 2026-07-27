import type { RuntimeRegistryPayload } from '@iris-ui-kit/registry'

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export interface IrisFontSource {
  url: string
  format?: 'woff2' | 'woff' | 'truetype' | 'opentype'
  weight?: string
  style?: 'normal' | 'italic' | 'oblique'
  unicodeRange?: string
  integrity?: string
}

export interface IrisFontResource {
  schema: 'iris-ui/font@1'
  family: string
  fallbacks?: string[]
  display?: FontDisplay
  sources: IrisFontSource[]
  /** Set `--iris-font-family` on the target after loading. */
  apply?: boolean
}

export interface IrisBlueprintNode {
  id: string
  /** Key into an application-owned, statically imported widget map. */
  widget: string
  props?: Record<string, JsonValue>
  /** Optional key into runtime data supplied to `compilePageBlueprint`. */
  dataKey?: string
  children?: IrisBlueprintNode[]
}

export interface IrisPageBlueprint {
  schema: 'iris-ui/page-blueprint@1'
  id: string
  version: string
  title?: string
  layout?: 'stack' | 'grid' | 'dashboard'
  columns?: number
  nodes: IrisBlueprintNode[]
}

export interface IrisCompiledBlueprintNode extends IrisBlueprintNode {
  data?: unknown
  children?: IrisCompiledBlueprintNode[]
}

export interface IrisViewSort {
  key: string
  direction: 'asc' | 'desc'
}

export interface IrisViewPreset {
  schema: 'iris-ui/view-preset@1'
  id: string
  version: string
  title?: string
  columns?: string[]
  hiddenColumns?: string[]
  filters?: Record<string, JsonValue>
  sort?: IrisViewSort[]
  pageSize?: number
  density?: 'compact' | 'default' | 'comfortable'
}

export interface IrisMarketplaceEntry {
  name: string
  type: RuntimeRegistryPayload['type']
  version: string
  url: string
  description?: string
  tags?: string[]
  preview?: string
  integrity?: string
}

export interface IrisMarketplaceManifest {
  schema: 'iris-ui/marketplace@1'
  name: string
  resources: IrisMarketplaceEntry[]
}

export interface InstalledRuntimeResource {
  name: string
  type: RuntimeRegistryPayload['type']
  version: string
  installedAt: string
  payload: RuntimeRegistryPayload
}

export interface RuntimeMarketplaceState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  entries: IrisMarketplaceEntry[]
  installed: InstalledRuntimeResource[]
  error?: string
}

export interface RuntimeMarketplaceStorage {
  load(): InstalledRuntimeResource[] | Promise<InstalledRuntimeResource[]>
  save(resources: InstalledRuntimeResource[]): void | Promise<void>
}

export type RuntimeResourceInstaller = (
  payload: RuntimeRegistryPayload,
) => void | (() => void) | Promise<void | (() => void)>
