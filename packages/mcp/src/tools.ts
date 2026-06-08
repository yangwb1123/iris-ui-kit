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
