import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ComponentGroup, Framework, RawComponent, RawDiscovery, RawTokens } from './schema'
import { ALL_FRAMEWORKS } from './schema'

const KNOWN_GROUPS: ComponentGroup[] = [
  'primitives',
  'layouts',
  'skeletons',
  'behaviors',
  'form',
  'theme',
  'floating',
  'modal-utils',
]

// `export const IrisX = ...` / `export function IrisX(...)`. Types
// (`export type IrisXProps`) are intentionally excluded. Used for the
// React/Vue/Solid adapters (all author components as exported functions/consts).
const EXPORT_RE = /export\s+(?:const|function)\s+(Iris[A-Za-z0-9]+)/g

// Svelte components are single-file `.svelte` modules re-exported from a barrel
// as `export { default as IrisX } from './X.svelte'`, so they are discovered
// from the barrels instead of from function/const declarations.
const SVELTE_EXPORT_RE = /export\s*\{\s*default as (Iris[A-Za-z0-9]+)/g

// Exported `Iris*` consts that are not components (injection keys, etc.).
const NON_COMPONENT = /(?:Key|Context|Symbol)$/

/** Walk up from a starting directory until the workspace root is found. */
export function findRepoRoot(startDir = dirname(fileURLToPath(import.meta.url))): string {
  let dir = startDir
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('Could not locate repo root (no pnpm-workspace.yaml found walking up)')
}

function walkSource(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkSource(full, acc)
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      acc.push(full)
    }
  }
  return acc
}

function classify(relPath: string): { group: ComponentGroup; module?: string } {
  const segments = relPath.split('/')
  const top = segments[0] as ComponentGroup
  const group = KNOWN_GROUPS.includes(top) ? top : 'other'
  const module = group === 'primitives' && segments.length > 1 ? segments[1] : undefined
  return { group, module }
}

function discoverFramework(repoRoot: string, framework: Framework): Map<string, RawComponent> {
  const srcRoot = join(repoRoot, 'packages', framework, 'src')
  const found = new Map<string, RawComponent>()
  if (!existsSync(srcRoot)) return found

  const re = framework === 'svelte' ? SVELTE_EXPORT_RE : EXPORT_RE
  for (const file of walkSource(srcRoot)) {
    const rel = file
      .slice(srcRoot.length + 1)
      .split('\\')
      .join('/')
    const { group, module } = classify(rel)
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(re)) {
      const name = match[1]
      if (NON_COMPONENT.test(name)) continue
      const existing = found.get(name)
      if (existing) {
        if (!existing.module && module) existing.module = module
        continue
      }
      found.set(name, { name, group, module, frameworks: [framework] })
    }
  }
  return found
}

function discoverTokens(repoRoot: string): RawTokens {
  const text = readFileSync(join(repoRoot, 'packages', 'tokens', 'src', 'tokens.ts'), 'utf8')
  const grab = (constName: string): string[] => {
    const block = text.match(new RegExp(`export const ${constName}[^=]*=\\s*\\[([\\s\\S]*?)\\]`))
    const body = block ? block[1] : ''
    return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1])
  }
  return {
    color: grab('COLOR_TOKENS'),
    spacing: grab('SPACING_TOKENS'),
    radii: grab('RADII_TOKENS'),
  }
}

/**
 * Discover the component inventory + token catalog directly from the package
 * sources, so the manifest can never drift from what the barrels actually
 * export.
 */
export function discover(repoRoot: string = findRepoRoot()): RawDiscovery {
  const perFramework = ALL_FRAMEWORKS.map((fw) => discoverFramework(repoRoot, fw))
  const names = new Set<string>()
  for (const map of perFramework) for (const name of map.keys()) names.add(name)

  const components: RawComponent[] = []
  for (const name of names) {
    const records = perFramework
      .map((map) => map.get(name))
      .filter((r): r is RawComponent => Boolean(r))
    const frameworks = records.flatMap((r) => r.frameworks)
    const base = records[0]
    components.push({
      name,
      group: base.group,
      module: records.find((r) => r.module)?.module,
      frameworks,
    })
  }
  return { components, tokens: discoverTokens(repoRoot) }
}
