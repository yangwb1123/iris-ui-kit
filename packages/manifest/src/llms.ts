import type { IrisManifest } from './schema'

/** Render a single component entry in the llms.txt listing. */
function renderComponentLines(
  component: IrisManifest['components'][number],
  lines: string[],
): void {
  const fw = (component as { frameworks?: string[] }).frameworks?.join('/') ?? ''
  const via = (component as { plugin?: string }).plugin
    ? ` — via ${(component as { plugin: string }).plugin} (IrisProvider plugins)`
    : ''
  lines.push(`- ${component.name} [${fw}] — ${component.layer}${via}`)
  if (component.description) lines.push(`  ${component.description}`)
  for (const framework of component.frameworks) {
    const contract = component.frameworkContracts?.[framework]
    if (!contract) continue
    const details: string[] = []
    if (contract.props.length) {
      details.push(
        `props ${contract.props.map((p) => `${p.name}${p.optional ? '?' : ''}`).join(', ')}`,
      )
    }
    if (contract.events.length) details.push(`events ${contract.events.join(', ')}`)
    if (contract.slots.length) details.push(`slots ${contract.slots.join(', ')}`)
    if (contract.publicTypes.length) details.push(`types ${contract.publicTypes.join(', ')}`)
    if (details.length) lines.push(`  ${framework}: ${details.join('; ')}`)
  }
}

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
      manifest.frameworks.map((f) => '`@iris-ui-kit/' + f + '`').join(' or ') +
      '.',
  )
  lines.push('')

  lines.push('## Architecture')
  for (const layer of manifest.layerModel) {
    lines.push('- ' + layer.layer + ': ' + layer.description)
  }
  lines.push('')

  const byFw = manifest.frameworks
    .map((f) => f + ' ' + String(manifest.stats.byFramework[f]))
    .join(', ')
  lines.push(
    '## Components (' +
      manifest.stats.total +
      ' total — ' +
      manifest.stats.full +
      ' in all ' +
      manifest.frameworks.length +
      ' frameworks; ' +
      byFw +
      ')',
  )
  for (const group of manifest.groups) {
    lines.push('')
    lines.push('### ' + group.group + ' (' + group.count + ')')
    for (const name of group.components) {
      const component = manifest.components.find((c) => c.name === name)
      if (component) renderComponentLines(component, lines)
    }
  }
  lines.push('')

  lines.push('## Design tokens (' + manifest.tokens.all.length + ')')
  lines.push('- colors: ' + manifest.tokens.color.join(', '))
  lines.push('- spacing: ' + manifest.tokens.spacing.join(', '))
  lines.push('- radii: ' + manifest.tokens.radii.join(', '))
  lines.push('- shadows: ' + manifest.tokens.shadows.join(', '))
  lines.push('- z-index: ' + manifest.tokens.zIndex.join(', '))
  lines.push('- transitions: ' + manifest.tokens.transitions.join(', '))
  lines.push('')

  return lines.join('\n')
}
