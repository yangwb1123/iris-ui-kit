import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createInstallPlan,
  createLockFile,
  createProjectConfig,
  diffRegistryFiles,
  filesForFramework,
  isIrisFramework,
  isSourceRegistryType,
  normalizeRelativePath,
  parseLockFile,
  parseProjectConfig,
  parseRegistryCatalog,
  parseRegistryItem,
  type IrisFramework,
  type IrisInstallPlan,
  type IrisLockFile,
  type IrisProjectConfig,
  type IrisRegistryCatalog,
  type IrisRegistryItem,
} from '@iris-ui-kit/registry'

const PROJECT_FILE = 'iris.json'
const LOCK_FILE = 'iris.lock.json'

export interface InitOptions {
  cwd?: string
  framework: IrisFramework
  force?: boolean
}

export interface RegistryAddOptions {
  cwd?: string
}

export interface InstallOptions {
  cwd?: string
  registry?: string
  force?: boolean
  dryRun?: boolean
  update?: boolean
}

interface LoadedItem {
  item: IrisRegistryItem
  location: string
  registry: string
}

interface PreparedPlan {
  loaded: LoadedItem
  plan: IrisInstallPlan
}

interface PlanExecution {
  prepared: PreparedPlan
  diffs: ReturnType<typeof diffRegistryFiles>
}

function writeJson(path: string, value: unknown): void {
  const temp = `${path}.iris-tmp`
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(temp, path)
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

function projectPath(cwd: string): string {
  return resolve(cwd, PROJECT_FILE)
}

function lockPath(cwd: string): string {
  return resolve(cwd, LOCK_FILE)
}

function loadProject(cwd: string): IrisProjectConfig {
  const path = projectPath(cwd)
  if (!existsSync(path)) {
    throw new Error(`Missing ${PROJECT_FILE}. Run "iris-ui init" first.`)
  }
  return parseProjectConfig(readJson(path))
}

function loadLock(cwd: string): IrisLockFile {
  const path = lockPath(cwd)
  return existsSync(path) ? parseLockFile(readJson(path)) : createLockFile()
}

function isHttp(location: string): boolean {
  return /^https?:\/\//.test(location)
}

function isFileUrl(location: string): boolean {
  return location.startsWith('file://')
}

function fileUrlPath(location: string): string {
  return fileURLToPath(location)
}

function resolveLocation(base: string, reference: string): string {
  if (isHttp(base)) {
    const resolved = new URL(reference, base)
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      throw new Error(`Remote registry references cannot use ${resolved.protocol}`)
    }
    if (base.startsWith('https://') && resolved.protocol !== 'https:') {
      throw new Error('HTTPS registries cannot downgrade child references to HTTP')
    }
    return resolved.toString()
  }
  if (isFileUrl(base)) {
    if (isHttp(reference)) return reference
    return isFileUrl(reference) ? reference : new URL(reference, base).toString()
  }
  if (isHttp(reference) || isFileUrl(reference) || isAbsolute(reference)) return reference
  const parent = existsSync(base) && statSync(base).isDirectory() ? base : dirname(base)
  return resolve(parent, reference)
}

async function loadText(location: string): Promise<string> {
  if (isHttp(location)) {
    const response = await fetch(location)
    if (!response.ok) throw new Error(`Unable to load ${location}: HTTP ${response.status}`)
    return response.text()
  }
  return readFileSync(isFileUrl(location) ? fileUrlPath(location) : location, 'utf8')
}

async function loadJson(location: string): Promise<unknown> {
  return JSON.parse(await loadText(location)) as unknown
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

async function resolvePlans(
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

function safeOutputPath(cwd: string, target: string): string {
  const root = realpathSync(resolve(cwd))
  const output = resolve(root, normalizeRelativePath(target))
  const rel = relative(root, output)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Unsafe output path: ${target}`)
  }
  let cursor = root
  for (const segment of rel.split(/[\\/]/)) {
    cursor = resolve(cursor, segment)
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      throw new Error(`Registry output cannot traverse a symbolic link: ${target}`)
    }
  }
  return output
}

export function sha256(content: string): string {
  return `sha256-${createHash('sha256').update(content).digest('hex')}`
}

export function runInit(options: InitOptions): number {
  const cwd = resolve(options.cwd ?? process.cwd())
  if (!isIrisFramework(options.framework)) {
    process.stderr.write(`Error: unsupported framework "${options.framework}".\n`)
    return 1
  }
  const configPath = projectPath(cwd)
  if (existsSync(configPath) && !options.force) {
    process.stderr.write(`Error: ${PROJECT_FILE} already exists. Use --force to replace it.\n`)
    return 1
  }
  mkdirSync(cwd, { recursive: true })
  writeJson(configPath, createProjectConfig(options.framework))
  if (!existsSync(lockPath(cwd))) writeJson(lockPath(cwd), createLockFile())
  process.stdout.write(`Created ${PROJECT_FILE} for ${options.framework}.\n`)
  return 0
}

export function runRegistryAdd(
  name: string,
  url: string,
  options: RegistryAddOptions = {},
): number {
  try {
    if (!/^[A-Za-z][A-Za-z0-9._-]{0,63}$/.test(name)) {
      throw new Error('registry name must be a safe identifier')
    }
    if (!url.trim()) throw new Error('registry location is required')
    const cwd = resolve(options.cwd ?? process.cwd())
    const config = loadProject(cwd)
    config.registries[name] = url
    writeJson(projectPath(cwd), config)
    process.stdout.write(`Registered ${name} → ${url}.\n`)
    return 0
  } catch (error) {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }
}

function mergePackageDependencies(cwd: string, plans: PreparedPlan[], dryRun: boolean): void {
  const path = resolve(cwd, 'package.json')
  if (!existsSync(path)) return
  const value = readJson(path)
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return
  const pkg = value as Record<string, unknown>
  const current =
    typeof pkg['dependencies'] === 'object' &&
    pkg['dependencies'] !== null &&
    !Array.isArray(pkg['dependencies'])
      ? (pkg['dependencies'] as Record<string, unknown>)
      : {}
  const dependencies: Record<string, string> = {}
  for (const [name, version] of Object.entries(current)) {
    if (typeof version === 'string') dependencies[name] = version
  }
  let changed = false
  for (const prepared of plans) {
    for (const [name, version] of Object.entries(prepared.plan.dependencies)) {
      if (dependencies[name] !== version) {
        dependencies[name] = version
        changed = true
      }
    }
  }
  if (changed && !dryRun) {
    pkg['dependencies'] = Object.fromEntries(
      Object.entries(dependencies).sort(([left], [right]) => left.localeCompare(right)),
    )
    writeJson(path, pkg)
  }
}

function inspectPlans(
  cwd: string,
  plans: PreparedPlan[],
  lock: IrisLockFile,
  options: InstallOptions,
): PlanExecution[] {
  const claimedTargets = new Map<string, string>()
  return plans.map((prepared) => {
    const current: Record<string, string | undefined> = {}
    for (const file of prepared.plan.files) {
      const owner = claimedTargets.get(file.target)
      if (owner) {
        throw new Error(
          `Registry items "${owner}" and "${prepared.plan.item.name}" both target ${file.target}`,
        )
      }
      claimedTargets.set(file.target, prepared.plan.item.name)
      const output = safeOutputPath(cwd, file.target)
      current[file.target] = existsSync(output) ? readFileSync(output, 'utf8') : undefined
    }
    const diffs = diffRegistryFiles(prepared.plan, current)
    const lockedFiles = lock.items[prepared.plan.item.name]?.files ?? {}
    const conflicts = diffs.filter((diff) => {
      if (diff.status !== 'update' || options.force || options.dryRun) return false
      const content = current[diff.target]
      const expected = lockedFiles[diff.target]
      return expected === undefined || content === undefined || sha256(content) !== expected
    })
    if (conflicts.length > 0) {
      throw new Error(
        `Refusing to overwrite locally modified or unmanaged files: ${conflicts
          .map((diff) => diff.target)
          .join(', ')}; use --force`,
      )
    }
    return { prepared, diffs }
  })
}

export async function runAdd(requests: string[], options: InstallOptions = {}): Promise<number> {
  try {
    if (requests.length === 0) throw new Error('at least one registry item is required')
    const cwd = resolve(options.cwd ?? process.cwd())
    const config = loadProject(cwd)
    const registry = options.registry ?? 'iris'
    const plans = await resolvePlans(requests, config, cwd, registry)
    const lock = loadLock(cwd)
    const executions = inspectPlans(cwd, plans, lock, options)

    for (const { prepared, diffs } of executions) {
      for (const [file, diff] of prepared.plan.files.map(
        (file, index) => [file, diffs[index]!] as const,
      )) {
        process.stdout.write(`${diff.status.padEnd(9)} ${file.target}\n`)
        if (options.dryRun || diff.status === 'unchanged') continue
        const output = safeOutputPath(cwd, file.target)
        mkdirSync(dirname(output), { recursive: true })
        writeFileSync(output, file.content, 'utf8')
      }

      if (!options.dryRun) {
        lock.items[prepared.plan.item.name] = {
          version: prepared.plan.item.version,
          type: prepared.plan.item.type,
          registry: prepared.loaded.registry,
          source: prepared.loaded.location,
          files: Object.fromEntries(
            prepared.plan.files.map((file) => [file.target, sha256(file.content)]),
          ),
          installedAt: new Date().toISOString(),
        }
      }
    }

    mergePackageDependencies(cwd, plans, Boolean(options.dryRun))
    if (!options.dryRun) writeJson(lockPath(cwd), lock)
    return 0
  } catch (error) {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }
}

export async function runDiff(
  requests: string[],
  options: Omit<InstallOptions, 'dryRun' | 'force' | 'update'> = {},
): Promise<number> {
  return runAdd(requests, { ...options, dryRun: true })
}

function resolveUpdateSource(
  name: string,
  locked: IrisLockFile['items'][string] | undefined,
  registryOverride: string | undefined,
): { request: string; registry: string | undefined } {
  if (registryOverride) return { request: name, registry: registryOverride }
  if (locked?.registry !== 'direct') return { request: name, registry: locked?.registry }
  if (!locked.source) {
    throw new Error(`Cannot update legacy direct install "${name}" without a source`)
  }
  return { request: locked.source, registry: undefined }
}

export async function runUpdate(
  requests: string[],
  options: Omit<InstallOptions, 'update'> = {},
): Promise<number> {
  try {
    const cwd = resolve(options.cwd ?? process.cwd())
    const lock = loadLock(cwd)
    const names =
      requests.length > 0 ? requests : Object.keys(lock.items).sort((a, b) => a.localeCompare(b))
    if (names.length === 0) {
      process.stdout.write('No registry items are installed.\n')
      return 0
    }
    for (const name of names) {
      const locked = lock.items[name]
      const { request, registry } = resolveUpdateSource(name, locked, options.registry)
      const result = await runAdd([request], {
        ...options,
        registry,
        update: true,
      })
      if (result !== 0) return result
    }
    return 0
  } catch (error) {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }
}
