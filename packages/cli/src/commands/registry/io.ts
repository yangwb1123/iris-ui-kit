import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeRelativePath } from '@iris-ui-kit/registry'

export const PROJECT_FILE = 'iris.json'
export const LOCK_FILE = 'iris.lock.json'

export function writeJson(path: string, value: unknown): void {
  const temp = `${path}.iris-tmp`
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(temp, path)
}

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

export function projectPath(cwd: string): string {
  return resolve(cwd, PROJECT_FILE)
}

export function lockPath(cwd: string): string {
  return resolve(cwd, LOCK_FILE)
}

export function isHttp(location: string): boolean {
  return /^https?:\/\//.test(location)
}

export function isFileUrl(location: string): boolean {
  return location.startsWith('file://')
}

export function fileUrlPath(location: string): string {
  return fileURLToPath(location)
}

export function resolveLocation(base: string, reference: string): string {
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

export async function loadText(location: string): Promise<string> {
  if (isHttp(location)) {
    const response = await fetch(location)
    if (!response.ok) throw new Error(`Unable to load ${location}: HTTP ${response.status}`)
    return response.text()
  }
  return readFileSync(isFileUrl(location) ? fileUrlPath(location) : location, 'utf8')
}

export async function loadJson(location: string): Promise<unknown> {
  return JSON.parse(await loadText(location)) as unknown
}

export function safeOutputPath(cwd: string, target: string): string {
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
