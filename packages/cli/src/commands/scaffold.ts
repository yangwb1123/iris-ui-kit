import type { Framework, IrisManifest, ManifestComponent } from '@iris-ui-kit/manifest'

/**
 * Emit a ready-to-edit code snippet: import line + JSX/tag usage with required
 * props pre-filled as placeholders.  Mirrors the logic in packages/mcp/src/tools.ts
 * (scaffoldSnippet) — kept here to avoid pulling in the MCP SDK as a dependency.
 */
function scaffoldSnippet(
  manifest: IrisManifest,
  name: string,
  framework: Framework,
): string | null {
  const component: ManifestComponent | undefined = manifest.components.find((c) => c.name === name)
  if (!component || !component.frameworks.includes(framework)) return null

  const importPath = component.importFrom[framework] ?? `@iris-ui-kit/${framework}`
  const required = (component.props ?? []).filter((p) => !p.optional)
  const pluginNote = component.plugin
    ? `\n// Requires <IrisProvider plugins={[…]}> — install ${component.plugin}`
    : ''

  if (framework === 'vue') {
    const vueAttrs = required.map((p) => `:${p.name}="/* ${p.type} */"`).join(' ')
    return `import { ${name} } from '${importPath}'${pluginNote}\n<${name}${vueAttrs ? ' ' + vueAttrs : ''} />`
  }

  const attrs = required.map((p) => `${p.name}={/* ${p.type} */}`).join(' ')
  const open = attrs ? `<${name} ${attrs}>` : `<${name}>`
  // svelte, react, and solid all use JSX-style syntax here.
  return `import { ${name} } from '${importPath}'${pluginNote}\n${open}</${name}>`
}

/**
 * Print a ready-to-paste code snippet for `componentName` in `framework`.
 * Returns the exit code (0 = ok, 1 = unknown component or unsupported framework).
 */
export function runScaffold(
  manifest: IrisManifest,
  componentName: string,
  framework: Framework,
): number {
  const snippet = scaffoldSnippet(manifest, componentName, framework)
  if (snippet === null) {
    const comp = manifest.components.find((c) => c.name === componentName)
    if (!comp) {
      process.stderr.write(`Error: unknown component "${componentName}".\n`)
    } else {
      process.stderr.write(
        `Error: "${componentName}" does not support framework "${framework}". ` +
          `Available: ${comp.frameworks.join(', ')}.\n`,
      )
    }
    return 1
  }

  process.stdout.write(snippet + '\n')
  return 0
}
