import {
  createProjectConfig,
  createLockFile,
  isIrisFramework,
  type IrisLockFile,
} from '@iris-ui-kit/registry'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

import { runAdd } from './install'
import { loadLock, loadProject } from './resolve'
import { PROJECT_FILE, lockPath, projectPath, writeJson } from './io'
import type { InitOptions, InstallOptions, RegistryAddOptions } from './types'

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
