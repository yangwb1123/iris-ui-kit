import type { IrisManifest } from './schema'

/**
 * Render the manifest as `llms.txt` — a compact, human- and LLM-readable
 * inventory a downstream project can drop into its own AGENTS.md so an agent
 * knows which components exist, where to import them, and which design tokens
 * are available.
 */
export function renderLlmsText(manifest: IrisManifest): string {
  const lines: string[] = []
  lines.push(`# ${manifest.name}`)
  lines.push('')
  lines.push(manifest.description)
  lines.push('')
  lines.push(
    `Frameworks: ${manifest.frameworks.join(', ')}. Import components from ` +
      manifest.frameworks.map((f) => `\`@iris-ui/${f}\``).join(' or ') +
      '.',
  )
  lines.push('')

  lines.push('## Architecture')
  for (const layer of manifest.layerModel) {
    lines.push(`- ${layer.layer}: ${layer.description}`)
  }
  lines.push('')

  lines.push(
    `## Components (${manifest.stats.total} total — ${manifest.stats.both} in both frameworks, ` +
      `${manifest.stats.reactOnly} react-only, ${manifest.stats.vueOnly} vue-only)`,
  )
  for (const group of manifest.groups) {
    lines.push('')
    lines.push(`### ${group.group} (${group.count})`)
    for (const name of group.components) {
      const component = manifest.components.find((c) => c.name === name)
      const fw = component ? component.frameworks.join('/') : ''
      lines.push(`- ${name} [${fw}]`)
    }
  }
  lines.push('')

  lines.push(`## Design tokens (${manifest.tokens.all.length})`)
  lines.push(`- colors: ${manifest.tokens.color.join(', ')}`)
  lines.push(`- spacing: ${manifest.tokens.spacing.join(', ')}`)
  lines.push(`- radii: ${manifest.tokens.radii.join(', ')}`)
  lines.push('')

  return lines.join('\n')
}
