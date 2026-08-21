import {
  createInstallPlan,
  createLockFile,
  filesForFramework,
  isSourceRegistryType,
  parseLockFile,
  parseProjectConfig,
  parseRegistryCatalog,
  parseRegistryItem,
  type IrisLockFile,
  type IrisProjectConfig,
  type IrisRegistryCatalog,
} from '@iris-ui-kit/registry'

import { existsSync } from 'node:fs'

import {
  PROJECT_FILE,
  isFileUrl,
  isHttp,
  loadJson,
  loadText,
  readJson,
  resolveLocation,
  sha256,
  lockPath,
  projectPath,
} from './io'
import type { LoadedItem, PreparedPlan } from './types'

export function loadProject(cwd: string): IrisProjectConfig {
  const path = projectPath(cwd)
  if (!existsSync(path)) {
    throw new Error(`Missing ${PROJECT_FILE}. Run "iris-ui init" first.`)
  }
  return parseProjectConfig(readJson(path))
}

export function loadLock(cwd: string): IrisLockFile {
  const path = lockPath(cwd)
  return existsSync(path) ? parseLockFile(readJson(path)) : createLockFile()
}

function registryLocation(config: IrisProjectConfig, cwd: string, registry: string): string {
  const configured = config.registries[registry]
  if (!configured) throw new Error(`Unknown registry "${registry}"`)
  return resolveLocation(cwd, configured)
}

async function loadCatalog(location: string): Promise<IrisRegistryCatalog> {
  return parseRegistryCatalog(await loadJson(location))
}

async function loadNamedItem(
  name: string,
  config: IrisProjectConfig,
  cwd: string,
  registry: string,
): Promise<LoadedItem> {
  const catalogLocation = registryLocation(config, cwd, registry)
  const catalog = await loadCatalog(catalogLocation)
  const entry = catalog.items.find((candidate) => candidate.name === name)
  if (!entry) throw new Error(`Registry "${registry}" has no item named "${name}"`)
  if (entry.frameworks && !entry.frameworks.includes(config.framework)) {
    throw new Error(`${name} does not support ${config.framework}`)
  }
  const location = resolveLocation(catalogLocation, entry.url)
  if (isHttp(catalogLocation) && !entry.integrity) {
    throw new Error(`Remote registry item "${name}" must declare integrity`)
  }
  const source = await loadText(location)
  if (entry.integrity && sha256(source) !== entry.integrity) {
    throw new Error(`Integrity check failed for registry item "${name}"`)
  }
  const item = parseRegistryItem(JSON.parse(source) as unknown)
  if (item.name !== entry.name || item.type !== entry.type || item.version !== entry.version) {
    throw new Error(`Registry catalog identity mismatch for "${name}"`)
  }
  if (!isSourceRegistryType(item.type)) {
    throw new Error(`${name} is a runtime resource; install it through the marketplace`)
  }
  return { item, location, registry }
}

async function loadRequestedItem(
  request: string,
  config: IrisProjectConfig,
  cwd: string,
  registry: string,
): Promise<LoadedItem> {
  const looksLikeLocation =
    request.endsWith('.json') ||
    request.startsWith('.') ||
    request.startsWith('/') ||
    isHttp(request) ||
    isFileUrl(request)
  if (!looksLikeLocation) return loadNamedItem(request, config, cwd, registry)
  const location = resolveLocation(cwd, request)
  const item = parseRegistryItem(await loadJson(location))
  if (!isSourceRegistryType(item.type)) {
    throw new Error(`${item.name} is a runtime resource; install it through the marketplace`)
  }
  return { item, location, registry: 'direct' }
}

async function preparePlan(loaded: LoadedItem, config: IrisProjectConfig): Promise<PreparedPlan> {
  const content: Record<string, string> = {}
  for (const file of filesForFramework(loaded.item, config.framework)) {
    if (file.content === undefined && file.source) {
      const location = resolveLocation(loaded.location, file.source)
      if (isHttp(loaded.location) && !file.integrity) {
        throw new Error(
          `Remote registry file ${loaded.item.name}/${file.source} must declare integrity`,
        )
      }
      const source = await loadText(location)
      if (file.integrity && sha256(source) !== file.integrity) {
        throw new Error(`Integrity check failed for ${loaded.item.name}/${file.source}`)
      }
      content[file.source] = source
    }
  }
  return { loaded, plan: createInstallPlan(loaded.item, config, content) }
}

export async function resolvePlans(
  requests: string[],
  config: IrisProjectConfig,
  cwd: string,
  registry: string,
): Promise<PreparedPlan[]> {
  const plans: PreparedPlan[] = []
  const visited = new Set<string>()
  const visit = async (request: string): Promise<void> => {
    if (visited.has(request)) return
    visited.add(request)
    const loaded = await loadRequestedItem(request, config, cwd, registry)
    for (const dependency of loaded.item.registryDependencies ?? []) await visit(dependency)
    plans.push(await preparePlan(loaded, config))
  }
  for (const request of requests) await visit(request)
  return plans
}
