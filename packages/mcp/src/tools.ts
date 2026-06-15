import type { Framework, IrisManifest, ManifestComponent } from '@iris-ui/manifest'
import { detectControlledPair, wiredTag } from './codegen'

/**
 * Pure query/codegen logic over an {@link IrisManifest}. These are the bodies of
 * the MCP tools, kept framework- and transport-free so they can be unit-tested
 * directly (the `server.ts` MCP wiring is a thin adapter over them).
 */

export { generateTest, generateView, type GenerateViewRequest } from './codegen'

/** A compact component summary for `list_components` / `search_components`. */
export interface ComponentSummary {
  name: string
  group: string
  frameworks: Framework[]
  plugin?: string
}

function summarize(c: ManifestComponent): ComponentSummary {
  return {
    name: c.name,
    group: c.group,
    frameworks: c.frameworks,
    ...(c.plugin ? { plugin: c.plugin } : {}),
  }
}

/** Every component, name-sorted. */
export function listComponents(manifest: IrisManifest): ComponentSummary[] {
  return manifest.components.map(summarize)
}

/** Components whose name or group contains `query` (case-insensitive). */
export function searchComponents(manifest: IrisManifest, query: string): ComponentSummary[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return manifest.components
    .filter((c) => c.name.toLowerCase().includes(q) || c.group.toLowerCase().includes(q))
    .map(summarize)
}

/** The full typed contract for one component, or null if unknown. */
export function getComponentApi(manifest: IrisManifest, name: string): ManifestComponent | null {
  return manifest.components.find((c) => c.name === name) ?? null
}

/**
 * Emit a ready-to-edit WIRED code snippet for a component in a framework: the
 * import line (core adapter or plugin sub-path) plus the usage. When the
 * component has a controlled value/handler pair (detected from the manifest prop
 * names — `value`+`onValueChange`, `checked`+`onChange`, `open`+`onOpenChange`,
 * …) it emits REAL state scaffolding for the target framework
 * (`useState`/`ref`/`createSignal`/`$state`) seeded from the manifest default
 * and binds it; non-controlled required props are filled from their manifest
 * default else a typed placeholder. Returns null for an unknown component or a
 * framework the component doesn't support.
 */
export function scaffoldSnippet(
  manifest: IrisManifest,
  name: string,
  framework: Framework,
): string | null {
  const component = getComponentApi(manifest, name)
  if (!component || !component.frameworks.includes(framework)) return null

  const importPath = component.importFrom[framework] ?? `@iris-ui/${framework}`
  const pluginNote = component.plugin
    ? `\n// Requires <IrisProvider plugins={[…]}> — install ${component.plugin}`
    : ''

  const pair = detectControlledPair(component)
  const tag = wiredTag(component, framework, pair)

  // No controlled state → keep the original import + bare-tag shape (stable).
  if (!pair) return `import { ${name} } from '${importPath}'${pluginNote}\n${tag}`

  // Controlled → prepend a real state declaration for the framework.
  const { local, default: seed } = pair
  const setter = `set${local[0]!.toUpperCase()}${local.slice(1)}`
  const decl =
    framework === 'react'
      ? `const [${local}, ${setter}] = React.useState(${seed})`
      : framework === 'solid'
        ? `const [${local}, ${setter}] = createSignal(${seed})`
        : framework === 'vue'
          ? `const ${local} = ref(${seed})`
          : `let ${local} = $state(${seed})`
  const stateImport =
    framework === 'react'
      ? "import * as React from 'react'\n"
      : framework === 'solid'
        ? "import { createSignal } from 'solid-js'\n"
        : framework === 'vue'
          ? "import { ref } from 'vue'\n"
          : ''
  return `${stateImport}import { ${name} } from '${importPath}'${pluginNote}\n\n${decl}\n${tag}`
}

/** The bare element/tag for `component` in `framework`, required props pre-filled (no import). */
function componentTag(component: ManifestComponent, framework: Framework): string {
  const { name } = component
  const required = (component.props ?? []).filter((p) => !p.optional)
  if (framework === 'vue') {
    const attrs = required.map((p) => `:${p.name}="/* ${p.type} */"`).join(' ')
    return `<${name}${attrs ? ' ' + attrs : ''} />`
  }
  const attrs = required.map((p) => `${p.name}={/* ${p.type} */}`).join(' ')
  return attrs ? `<${name} ${attrs}></${name}>` : `<${name}></${name}>`
}

export interface ScaffoldViewRequest {
  framework: Framework
  /** Component names to place inside the view, in order. */
  components: string[]
  /** Optional container component to wrap the children (e.g. a layout/card). */
  layout?: string
}

/**
 * Compose SEVERAL components into one ready-to-edit view: deduped imports
 * (grouped by source module) + a parent container — the `layout` component if
 * given, else a plain wrapper — holding each child pre-filled with its required
 * props. The multi-component counterpart to {@link scaffoldSnippet} (the
 * "prompt → composed UI" surface). Returns null if `components` is empty or any
 * named component (incl. `layout`) is unknown or unsupported in `framework`.
 */
export function scaffoldView(manifest: IrisManifest, req: ScaffoldViewRequest): string | null {
  const { framework, components, layout } = req
  if (components.length === 0) return null
  const names = layout ? [layout, ...components] : components
  const resolved = names.map((n) => getComponentApi(manifest, n))
  if (resolved.some((c) => !c || !c.frameworks.includes(framework))) return null
  const all = resolved as ManifestComponent[]

  // Deduped imports grouped by source module so multiple components from the
  // same package share one import statement.
  const byPath = new Map<string, Set<string>>()
  const pluginNotes: string[] = []
  for (const c of all) {
    const path = c.importFrom[framework] ?? `@iris-ui/${framework}`
    if (!byPath.has(path)) byPath.set(path, new Set())
    byPath.get(path)!.add(c.name)
    if (c.plugin) pluginNotes.push(`// Requires <IrisProvider plugins={[…]}> — install ${c.plugin}`)
  }
  const imports = Array.from(byPath, ([path, set]) => {
    const importedNames = Array.from(set).sort().join(', ')
    return `import { ${importedNames} } from '${path}'`
  }).join('\n')
  const notes = [...new Set(pluginNotes)]
  const header = notes.length ? imports + '\n' + notes.join('\n') : imports

  const children = components
    .map((n) => '  ' + componentTag(getComponentApi(manifest, n)!, framework))
    .join('\n')

  if (layout) return `${header}\n\n<${layout}>\n${children}\n</${layout}>`
  const classAttr = framework === 'vue' ? 'class' : 'className'
  return `${header}\n\n<div ${classAttr}="iris-view">\n${children}\n</div>`
}

/** A ranked component recommendation with the terms that matched. */
export interface ComponentSuggestion extends ComponentSummary {
  score: number
  rationale: string
}

/**
 * Recommend components for a free-text requirement (e.g. "a date picker for a
 * form", "tabs with keyboard nav"). A dependency-free heuristic: split the
 * requirement into terms and score each component by where the term hits —
 * name/group match weighs more than a prop-name/description match. Returns the
 * top `limit`, highest score first. Helps an agent PICK a component instead of
 * scanning the whole list.
 */
export function suggestComponents(
  manifest: IrisManifest,
  requirement: string,
  limit = 5,
): ComponentSuggestion[] {
  const terms = [
    ...new Set(
      requirement
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2),
    ),
  ]
  if (terms.length === 0) return []
  const scored = manifest.components
    .map((c) => {
      const nameGroup = `${c.name} ${c.group}`.toLowerCase()
      const props = (c.props ?? [])
        .map((p) => `${p.name} ${p.description ?? ''}`)
        .join(' ')
        .toLowerCase()
      const matched: string[] = []
      let score = 0
      for (const t of terms) {
        if (nameGroup.includes(t)) {
          score += 3
          matched.push(t)
        } else if (props.includes(t)) {
          score += 1
          matched.push(t)
        }
      }
      return { c, score, matched }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
  return scored.map((x) => ({
    ...summarize(x.c),
    score: x.score,
    rationale: `matched: ${x.matched.join(', ')}`,
  }))
}

/** A component usage to validate against the manifest. */
export interface UsageToValidate {
  name: string
  framework?: Framework
  /** prop name → the value as written (quotes optional for string literals). */
  props?: Record<string, string>
}

export interface UsageIssue {
  severity: 'error' | 'warning'
  message: string
}

const stripQuotes = (v: string): string => v.trim().replace(/^['"]|['"]$/g, '')

/**
 * Validate a component usage against the typed manifest — the "verify your
 * guess" counterpart to the typed contracts: unknown component / unsupported
 * framework / missing required prop / unknown prop / invalid enum value (using
 * the manifest's enumerated literal values) / plugin-activation reminder. An
 * agent can call this before emitting code instead of guess-and-check.
 */
export function validateUsage(manifest: IrisManifest, usage: UsageToValidate): UsageIssue[] {
  const issues: UsageIssue[] = []
  const component = getComponentApi(manifest, usage.name)
  if (!component) {
    issues.push({ severity: 'error', message: `Unknown component "${usage.name}".` })
    return issues
  }
  if (usage.framework && !component.frameworks.includes(usage.framework)) {
    issues.push({
      severity: 'error',
      message: `${usage.name} is not available in ${usage.framework} (available: ${component.frameworks.join(', ')}).`,
    })
  }
  if (component.plugin) {
    issues.push({
      severity: 'warning',
      message: `${usage.name} requires the ${component.plugin} plugin via <IrisProvider plugins={[…]}>.`,
    })
  }
  const props = component.props ?? []
  const known = new Map(props.map((p) => [p.name, p]))
  const provided = usage.props ?? {}
  for (const p of props) {
    if (!p.optional && !(p.name in provided)) {
      issues.push({ severity: 'error', message: `Missing required prop "${p.name}" (${p.type}).` })
    }
  }
  for (const [name, value] of Object.entries(provided)) {
    const p = known.get(name)
    if (!p) {
      issues.push({ severity: 'warning', message: `Unknown prop "${name}" on ${usage.name}.` })
      continue
    }
    if (p.enum && p.enum.length > 0) {
      const v = stripQuotes(value)
      if (v && !p.enum.includes(v)) {
        issues.push({
          severity: 'error',
          message: `Invalid value "${value}" for "${name}". One of: ${p.enum.map((e) => `'${e}'`).join(', ')}.`,
        })
      }
    }
  }
  return issues
}
