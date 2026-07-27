export const IRIS_FRAMEWORKS = ['react', 'vue', 'solid', 'svelte'] as const
export type IrisFramework = (typeof IRIS_FRAMEWORKS)[number]

export const IRIS_REGISTRY_ITEM_TYPES = [
  'iris:template',
  'iris:page',
  'iris:block',
  'iris:component',
  'iris:skin',
  'iris:font',
  'iris:blueprint',
  'iris:view',
] as const
export type IrisRegistryItemType = (typeof IRIS_REGISTRY_ITEM_TYPES)[number]

export const SOURCE_ITEM_TYPES: readonly IrisRegistryItemType[] = [
  'iris:template',
  'iris:page',
  'iris:block',
  'iris:component',
]

export const RUNTIME_ITEM_TYPES: readonly IrisRegistryItemType[] = [
  'iris:skin',
  'iris:font',
  'iris:blueprint',
  'iris:view',
]

export type IrisRegistryFileType = 'source' | 'style' | 'config' | 'asset' | 'data'

export interface IrisRegistryFile {
  /** Stable source path, resolved relative to the item document URL. */
  source?: string
  /** Inline content; useful for small remote registries and tests. */
  content?: string
  /** Project alias plus relative path, for example `templates/admin-shell.tsx`. */
  target: string
  type?: IrisRegistryFileType
  frameworks?: IrisFramework[]
  /** Optional SHA-256 in `sha256-<hex>` form. */
  integrity?: string
}

export interface IrisRegistryItem {
  schema: 'iris-ui/registry-item@1'
  name: string
  type: IrisRegistryItemType
  title?: string
  description?: string
  version: string
  frameworks?: IrisFramework[]
  files: IrisRegistryFile[]
  /** Other registry items installed before this one. */
  registryDependencies?: string[]
  /** Package name → semver range, merged into the consumer package.json. */
  dependencies?: Record<string, string>
  /** Adapter-specific package dependencies; only the selected framework is merged. */
  dependenciesByFramework?: Partial<Record<IrisFramework, Record<string, string>>>
  /** Optional Iris plugin packages required by the installed source. */
  plugins?: string[]
  meta?: Record<string, unknown>
}

export interface IrisRegistryCatalogItem {
  name: string
  type: IrisRegistryItemType
  version: string
  description?: string
  /** Item document URL/path, relative to the catalog document. */
  url: string
  /** SHA-256 of the item document, required by the CLI for remote catalogs. */
  integrity?: string
  frameworks?: IrisFramework[]
}

export interface IrisRegistryCatalog {
  schema: 'iris-ui/registry@1'
  name: string
  homepage?: string
  items: IrisRegistryCatalogItem[]
}

export interface IrisProjectAliases {
  components: string
  templates: string
  pages: string
  blocks: string
  skins: string
  fonts: string
  blueprints: string
  views: string
}

export interface IrisProjectConfig {
  schema: 'iris-ui/project@1'
  framework: IrisFramework
  aliases: IrisProjectAliases
  registries: Record<string, string>
}

export interface IrisLockFileEntry {
  version: string
  type: IrisRegistryItemType
  registry: string
  /** Resolved item document location; required to update direct URL/path installs. */
  source?: string
  files: Record<string, string>
  installedAt: string
}

export interface IrisLockFile {
  schema: 'iris-ui/lock@1'
  items: Record<string, IrisLockFileEntry>
}

export interface ResolvedRegistryFile extends IrisRegistryFile {
  content: string
  target: string
}

export interface IrisInstallPlan {
  item: IrisRegistryItem
  files: ResolvedRegistryFile[]
  dependencies: Record<string, string>
  plugins: string[]
}

export interface IrisRegistryDiagnostic {
  path: string
  message: string
}

export interface RegistryFileDiff {
  target: string
  status: 'add' | 'update' | 'unchanged'
}

export interface RuntimeRegistryPayload {
  name: string
  type: Extract<IrisRegistryItemType, 'iris:skin' | 'iris:font' | 'iris:blueprint' | 'iris:view'>
  version: string
  data: unknown
  integrity?: string
}
