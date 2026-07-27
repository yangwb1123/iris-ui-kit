import type { IrisManifest } from '@iris-ui-kit/manifest'

/**
 * Print each component as a single line:
 *   IrisButton  [react, vue, solid, svelte]  primitives
 *
 * If `group` is provided only components in that group are printed.
 * Returns the exit code (0 = ok, 1 = no results).
 */
export function runList(manifest: IrisManifest, group?: string): number {
  const components = group
    ? manifest.components.filter((c) => c.group === group)
    : manifest.components

  if (components.length === 0) {
    process.stderr.write(`No components found${group ? ` in group "${group}"` : ''}.\n`)
    return 1
  }

  for (const c of components) {
    const fw = `[${c.frameworks.join(', ')}]`
    process.stdout.write(`${c.name.padEnd(36)}${fw.padEnd(36)}${c.group}\n`)
  }

  return 0
}
