import type { Framework, IrisManifest, ManifestComponent } from '@iris-ui/manifest'

/**
 * Pure query/codegen logic over an {@link IrisManifest}. These are the bodies of
 * the MCP tools, kept framework- and transport-free so they can be unit-tested
 * directly (the `server.ts` MCP wiring is a thin adapter over them).
 */

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
 * Emit a ready-to-edit code snippet for a component in a framework: the import
 * line (core adapter or plugin sub-path) plus a JSX/tag usage pre-filled with
 * the component's REQUIRED (non-optional) props as placeholders. Returns null
 * for an unknown component or a framework the component doesn't support.
 */
export function scaffoldSnippet(
  manifest: IrisManifest,
  name: string,
  framework: Framework,
): string | null {
  const component = getComponentApi(manifest, name)
  if (!component || !component.frameworks.includes(framework)) return null

  const importPath = component.importFrom[framework] ?? `@iris-ui/${framework}`
  const required = (component.props ?? []).filter((p) => !p.optional)
  const attrs = required.map((p) => `${p.name}={/* ${p.type} */}`).join(' ')
  const open = attrs ? `<${name} ${attrs}>` : `<${name}>`

  const pluginNote = component.plugin
    ? `\n// Requires <IrisProvider plugins={[…]}> — install ${component.plugin}`
    : ''

  if (framework === 'vue') {
    const vueAttrs = required.map((p) => `:${p.name}="/* ${p.type} */"`).join(' ')
    return `import { ${name} } from '${importPath}'${pluginNote}\n<${name}${vueAttrs ? ' ' + vueAttrs : ''} />`
  }
  if (framework === 'svelte') {
    return `import { ${name} } from '${importPath}'${pluginNote}\n${open}</${name}>`
  }
  // react / solid share JSX.
  return `import { ${name} } from '${importPath}'${pluginNote}\n${open}</${name}>`
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
