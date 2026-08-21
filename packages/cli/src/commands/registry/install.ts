import { diffRegistryFiles, type IrisLockFile } from '@iris-ui-kit/registry'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { lockPath, readJson, safeOutputPath, sha256, writeJson } from './io'
import { loadLock, loadProject, resolvePlans } from './resolve'
import type { InstallOptions, PlanExecution, PreparedPlan } from './types'

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
