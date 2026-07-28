/**
 * Iris Registry is deliberately split from the runtime plugin system:
 *
 * - source items (templates/pages/blocks/components) are installed by the CLI
 *   while developing and remain normal statically imported application code;
 * - declarative items (skins/fonts/blueprints/views) may be installed at
 *   runtime because they cannot execute arbitrary component code.
 */

import {
  IRIS_FRAMEWORKS,
  IRIS_REGISTRY_ITEM_TYPES,
  RUNTIME_ITEM_TYPES,
  SOURCE_ITEM_TYPES,
  type IrisFramework,
  type IrisInstallPlan,
  type IrisLockFile,
  type IrisProjectAliases,
  type IrisProjectConfig,
  type IrisRegistryCatalog,
  type IrisRegistryDiagnostic,
  type IrisRegistryFile,
  type IrisRegistryItem,
  type IrisRegistryItemType,
  type RegistryFileDiff,
  type RuntimeRegistryPayload,
} from './types'

export * from './types'

const DEFAULT_ALIASES: IrisProjectAliases = {
  components: 'src/components',
  templates: 'src/templates',
  pages: 'src/pages',
  blocks: 'src/blocks',
  skins: 'src/skins',
  fonts: 'src/fonts',
  blueprints: 'src/blueprints',
  views: 'src/views',
}

export function createProjectConfig(
  framework: IrisFramework,
  overrides: Partial<IrisProjectConfig> = {},
): IrisProjectConfig {
  return {
    schema: 'iris-ui/project@1',
    framework,
    aliases: { ...DEFAULT_ALIASES, ...overrides.aliases },
    registries: {
      iris: 'https://raw.githubusercontent.com/yangwb1123/iris-ui-kit/main/registry/registry.json',
      ...overrides.registries,
    },
  }
}

export function createLockFile(): IrisLockFile {
  return { schema: 'iris-ui/lock@1', items: {} }
}

export function isIrisFramework(value: unknown): value is IrisFramework {
  return typeof value === 'string' && IRIS_FRAMEWORKS.some((framework) => framework === value)
}

export function isSourceRegistryType(type: IrisRegistryItemType): boolean {
  return SOURCE_ITEM_TYPES.some((candidate) => candidate === type)
}

export function isRuntimeRegistryType(type: IrisRegistryItemType): boolean {
  return RUNTIME_ITEM_TYPES.some((candidate) => candidate === type)
}

export function registryAliasForType(type: IrisRegistryItemType): keyof IrisProjectAliases {
  const aliases: Record<IrisRegistryItemType, keyof IrisProjectAliases> = {
    'iris:template': 'templates',
    'iris:page': 'pages',
    'iris:block': 'blocks',
    'iris:component': 'components',
    'iris:skin': 'skins',
    'iris:font': 'fonts',
    'iris:blueprint': 'blueprints',
    'iris:view': 'views',
  }
  return aliases[type]
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function validateFrameworks(
  value: unknown,
  path: string,
  diagnostics: IrisRegistryDiagnostic[],
): void {
  if (value === undefined) return
  if (!Array.isArray(value) || value.some((framework) => !isIrisFramework(framework))) {
    diagnostics.push({ path, message: 'must contain only react, vue, solid, or svelte' })
  }
}

export function validateRegistryItem(value: unknown): IrisRegistryDiagnostic[] {
  const diagnostics: IrisRegistryDiagnostic[] = []
  const item = record(value)
  if (!item) return [{ path: '$', message: 'must be an object' }]
  if (item['schema'] !== 'iris-ui/registry-item@1') {
    diagnostics.push({ path: 'schema', message: 'must equal iris-ui/registry-item@1' })
  }
  if (!nonEmptyString(item['name'])) diagnostics.push({ path: 'name', message: 'is required' })
  if (!IRIS_REGISTRY_ITEM_TYPES.some((type) => type === item['type'])) {
    diagnostics.push({ path: 'type', message: 'is not a supported Iris registry item type' })
  }
  if (!nonEmptyString(item['version'])) {
    diagnostics.push({ path: 'version', message: 'is required' })
  }
  validateFrameworks(item['frameworks'], 'frameworks', diagnostics)
  if (!Array.isArray(item['files']) || item['files'].length === 0) {
    diagnostics.push({ path: 'files', message: 'must contain at least one file' })
  } else {
    item['files'].forEach((rawFile, index) => {
      const file = record(rawFile)
      const path = `files[${index}]`
      if (!file) {
        diagnostics.push({ path, message: 'must be an object' })
        return
      }
      if (!nonEmptyString(file['target'])) {
        diagnostics.push({ path: `${path}.target`, message: 'is required' })
      } else if (!isSafeRelativePath(file['target'])) {
        diagnostics.push({ path: `${path}.target`, message: 'must be a safe relative path' })
      }
      if (!nonEmptyString(file['source']) && typeof file['content'] !== 'string') {
        diagnostics.push({ path, message: 'requires source or content' })
      }
      if (
        file['integrity'] !== undefined &&
        (typeof file['integrity'] !== 'string' || !/^sha256-[a-f\d]{64}$/i.test(file['integrity']))
      ) {
        diagnostics.push({ path: `${path}.integrity`, message: 'must be a SHA-256 digest' })
      }
      validateFrameworks(file['frameworks'], `${path}.frameworks`, diagnostics)
    })
  }
  return diagnostics
}

export function parseRegistryItem(value: unknown): IrisRegistryItem {
  const diagnostics = validateRegistryItem(value)
  if (diagnostics.length > 0) {
    throw new Error(formatRegistryDiagnostics('Invalid registry item', diagnostics))
  }
  return value as IrisRegistryItem
}

export function validateRegistryCatalog(value: unknown): IrisRegistryDiagnostic[] {
  const diagnostics: IrisRegistryDiagnostic[] = []
  const catalog = record(value)
  if (!catalog) return [{ path: '$', message: 'must be an object' }]
  if (catalog['schema'] !== 'iris-ui/registry@1') {
    diagnostics.push({ path: 'schema', message: 'must equal iris-ui/registry@1' })
  }
  if (!nonEmptyString(catalog['name'])) diagnostics.push({ path: 'name', message: 'is required' })
  if (!Array.isArray(catalog['items'])) {
    diagnostics.push({ path: 'items', message: 'must be an array' })
  } else {
    const names = new Set<string>()
    catalog['items'].forEach((rawEntry, index) => {
      const entry = record(rawEntry)
      const path = `items[${index}]`
      if (!entry) {
        diagnostics.push({ path, message: 'must be an object' })
        return
      }
      if (!nonEmptyString(entry['name'])) {
        diagnostics.push({ path: `${path}.name`, message: 'is required' })
      } else if (names.has(entry['name'])) {
        diagnostics.push({ path: `${path}.name`, message: 'must be unique' })
      } else {
        names.add(entry['name'])
      }
      if (!nonEmptyString(entry['url'])) {
        diagnostics.push({ path: `${path}.url`, message: 'is required' })
      }
      if (
        entry['integrity'] !== undefined &&
        (typeof entry['integrity'] !== 'string' ||
          !/^sha256-[a-f\d]{64}$/i.test(entry['integrity']))
      ) {
        diagnostics.push({ path: `${path}.integrity`, message: 'must be a SHA-256 digest' })
      }
      if (!IRIS_REGISTRY_ITEM_TYPES.some((type) => type === entry['type'])) {
        diagnostics.push({ path: `${path}.type`, message: 'is not supported' })
      }
      if (!nonEmptyString(entry['version'])) {
        diagnostics.push({ path: `${path}.version`, message: 'is required' })
      }
      validateFrameworks(entry['frameworks'], `${path}.frameworks`, diagnostics)
    })
  }
  return diagnostics
}

export function parseRegistryCatalog(value: unknown): IrisRegistryCatalog {
  const diagnostics = validateRegistryCatalog(value)
  if (diagnostics.length > 0) {
    throw new Error(formatRegistryDiagnostics('Invalid registry catalog', diagnostics))
  }
  return value as IrisRegistryCatalog
}

export function parseProjectConfig(value: unknown): IrisProjectConfig {
  const config = record(value)
  if (!config || config['schema'] !== 'iris-ui/project@1') {
    throw new Error('Invalid Iris project config: schema must equal iris-ui/project@1')
  }
  if (!isIrisFramework(config['framework'])) {
    throw new Error('Invalid Iris project config: framework is not supported')
  }
  const aliases = record(config['aliases'])
  const registries = record(config['registries'])
  if (!aliases || !registries) {
    throw new Error('Invalid Iris project config: aliases and registries are required')
  }
  const normalizedAliases = { ...DEFAULT_ALIASES }
  for (const key of Object.keys(normalizedAliases) as Array<keyof IrisProjectAliases>) {
    const alias = aliases[key]
    if (!nonEmptyString(alias) || !isSafeRelativePath(alias)) {
      throw new Error(`Invalid Iris project config: aliases.${key} must be a safe relative path`)
    }
    normalizedAliases[key] = normalizeRelativePath(alias)
  }
  const normalizedRegistries: Record<string, string> = {}
  for (const [name, location] of Object.entries(registries)) {
    if (!nonEmptyString(name) || !nonEmptyString(location)) {
      throw new Error('Invalid Iris project config: registry names and locations must be strings')
    }
    normalizedRegistries[name] = location
  }
  return {
    schema: 'iris-ui/project@1',
    framework: config['framework'],
    aliases: normalizedAliases,
    registries: normalizedRegistries,
  }
}

export function parseLockFile(value: unknown): IrisLockFile {
  const lock = record(value)
  if (!lock || lock['schema'] !== 'iris-ui/lock@1' || !record(lock['items'])) {
    throw new Error('Invalid Iris lock file')
  }
  return value as IrisLockFile
}

export function formatRegistryDiagnostics(
  heading: string,
  diagnostics: IrisRegistryDiagnostic[],
): string {
  return [
    heading,
    ...diagnostics.map((diagnostic) => `- ${diagnostic.path}: ${diagnostic.message}`),
  ]
    .join('\n')
    .trim()
}

export function normalizeRelativePath(path: string): string {
  return path
    .replaceAll('\\', '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
}

export function isSafeRelativePath(path: string): boolean {
  if (!nonEmptyString(path)) return false
  const normalized = normalizeRelativePath(path)
  if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) return false
  return normalized.split('/').every((segment) => segment !== '..' && segment !== '')
}

export function resolveRegistryTarget(
  config: IrisProjectConfig,
  item: IrisRegistryItem,
  file: IrisRegistryFile,
): string {
  if (!isSafeRelativePath(file.target)) {
    throw new Error(`Unsafe registry target: ${file.target}`)
  }
  const normalized = normalizeRelativePath(file.target)
  const [first, ...rest] = normalized.split('/')
  const alias = first && first in config.aliases ? (first as keyof IrisProjectAliases) : undefined
  if (alias) {
    if (rest.length === 0) throw new Error(`Registry target must include a file: ${file.target}`)
    return `${config.aliases[alias]}/${rest.join('/')}`
  }
  return `${config.aliases[registryAliasForType(item.type)]}/${normalized}`
}

export function filesForFramework(
  item: IrisRegistryItem,
  framework: IrisFramework,
): IrisRegistryFile[] {
  if (item.frameworks && !item.frameworks.includes(framework)) return []
  return item.files.filter((file) => !file.frameworks || file.frameworks.includes(framework))
}

export function createInstallPlan(
  item: IrisRegistryItem,
  config: IrisProjectConfig,
  contentBySource: Readonly<Record<string, string>> = {},
): IrisInstallPlan {
  const files = filesForFramework(item, config.framework).map((file) => {
    const content = file.content ?? (file.source ? contentBySource[file.source] : undefined)
    if (content === undefined) {
      throw new Error(`Missing content for ${file.source ?? file.target}`)
    }
    return {
      ...file,
      content,
      target: resolveRegistryTarget(config, item, file),
    }
  })
  if (files.length === 0) {
    throw new Error(`${item.name} does not support ${config.framework}`)
  }
  const targets = files.map((file) => file.target)
  if (new Set(targets).size !== targets.length) {
    throw new Error(`${item.name} resolves multiple files to the same target`)
  }
  return {
    item,
    files,
    dependencies: {
      ...item.dependencies,
      ...item.dependenciesByFramework?.[config.framework],
    },
    plugins: [...(item.plugins ?? [])],
  }
}

export function diffRegistryFiles(
  plan: IrisInstallPlan,
  current: Readonly<Record<string, string | undefined>>,
): RegistryFileDiff[] {
  return plan.files.map((file) => ({
    target: file.target,
    status:
      current[file.target] === undefined
        ? 'add'
        : current[file.target] === file.content
          ? 'unchanged'
          : 'update',
  }))
}

export function parseRuntimeRegistryPayload(value: unknown): RuntimeRegistryPayload {
  const payload = record(value)
  if (
    !payload ||
    !nonEmptyString(payload['name']) ||
    !nonEmptyString(payload['version']) ||
    !IRIS_REGISTRY_ITEM_TYPES.some((type) => type === payload['type']) ||
    !isRuntimeRegistryType(payload['type'] as IrisRegistryItemType) ||
    !('data' in payload)
  ) {
    throw new Error('Invalid runtime registry payload')
  }
  return value as RuntimeRegistryPayload
}
