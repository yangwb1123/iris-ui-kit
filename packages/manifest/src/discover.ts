import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  ComponentGroup,
  Framework,
  ManifestProp,
  RawComponent,
  RawDiscovery,
  RawTokens,
} from './schema'
import { ALL_FRAMEWORKS } from './schema'
import { extractComponentProps, classifyProps } from './props'
import { extractComponentDocs } from './descriptions'
import { extractFrameworkContracts } from './contracts'

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

// `export const IrisX = ...` / `export function IrisX(...)` / `export class IrisX`
// (the last covers React class components like IrisErrorBoundary). Types
// (`export type IrisXProps`) are intentionally excluded. Used for the
// React/Vue/Solid adapters.
const EXPORT_RE = /export\s+(?:const|function|class)\s+(Iris[A-Za-z0-9]+)/g

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

/**
 * Discover plugin-shipped components under each `packages/plugin-<name>/src/
 * <framework>/` directory. Plugins are single packages with a per-framework
 * sub-path (`@iris-ui-kit/plugin-x/react`, …); their `Iris*` exports are tagged
 * `group: 'plugin'` plus the owning package so an agent reading the manifest can
 * find them AND knows they need `<IrisProvider plugins={[…]}>` activation.
 * Returns name → record.
 */
function discoverPlugins(repoRoot: string): Map<string, RawComponent> {
  const found = new Map<string, RawComponent>()
  const packagesDir = join(repoRoot, 'packages')
  if (!existsSync(packagesDir)) return found

  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('plugin-')) continue
    const pluginPkg = `@iris-ui-kit/${entry.name}`
    for (const framework of ALL_FRAMEWORKS) {
      const fwDir = join(packagesDir, entry.name, 'src', framework)
      if (!existsSync(fwDir)) continue
      const re = framework === 'svelte' ? SVELTE_EXPORT_RE : EXPORT_RE
      for (const file of walkSource(fwDir)) {
        const text = readFileSync(file, 'utf8')
        for (const match of text.matchAll(re)) {
          const name = match[1]
          if (NON_COMPONENT.test(name)) continue
          const existing = found.get(name)
          if (existing) {
            if (!existing.frameworks.includes(framework)) existing.frameworks.push(framework)
            continue
          }
          found.set(name, { name, group: 'plugin', frameworks: [framework], plugin: pluginPkg })
        }
      }
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
    shadows: grab('SHADOW_TOKENS'),
    zIndex: grab('ZINDEX_TOKENS'),
    transitions: grab('TRANSITION_TOKENS'),
  }
}

/** Build a component record with optional props, docs, events, and slots. */
function buildComponentRecord(
  base: {
    name: string
    group: ComponentGroup
    frameworks: Framework[]
    plugin?: string
    module?: string
  },
  propsByName: Map<string, ManifestProp[]>,
  docsByName: Map<string, { description?: string; example?: string }>,
  contractsByName: ReturnType<typeof extractFrameworkContracts>,
): RawComponent {
  const props = propsByName.get(base.name)
  const doc = docsByName.get(base.name)
  const classified = props ? classifyProps(props) : { events: [], slots: [] }
  const extractedContracts = contractsByName.get(base.name) ?? {}
  const frameworkContracts = Object.fromEntries(
    base.frameworks.map((framework) => [
      framework,
      extractedContracts[framework] ?? {
        source: 'unavailable' as const,
        props: [],
        events: [],
        slots: [],
        publicTypes: [],
      },
    ]),
  )
  return {
    name: base.name,
    group: base.group,
    frameworks: base.frameworks,
    module: base.module,
    ...(base.plugin ? { plugin: base.plugin } : {}),
    ...(doc?.description ? { description: doc.description } : {}),
    ...(doc?.example ? { example: doc.example } : {}),
    ...(props ? { props } : {}),
    ...(classified.events.length ? { events: classified.events } : {}),
    ...(classified.slots.length ? { slots: classified.slots } : {}),
    frameworkContracts,
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

  const propsByName = extractComponentProps(repoRoot)
  const docsByName = extractComponentDocs(repoRoot)
  const contractsByName = extractFrameworkContracts(repoRoot)

  const components: RawComponent[] = []
  for (const name of names) {
    const records = perFramework
      .map((map) => map.get(name))
      .filter((r): r is RawComponent => Boolean(r))
    const frameworks = records.flatMap((r) => r.frameworks)
    const base = records[0]
    components.push(
      buildComponentRecord(
        {
          name: base.name,
          group: base.group,
          frameworks,
          module: records.find((r) => r.module)?.module,
        },
        propsByName,
        docsByName,
        contractsByName,
      ),
    )
  }

  // Plugin components are namespaced separately
  for (const record of discoverPlugins(repoRoot).values()) {
    components.push(buildComponentRecord(record, propsByName, docsByName, contractsByName))
  }

  return { components, tokens: discoverTokens(repoRoot) }
}
