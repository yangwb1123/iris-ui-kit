import type { IrisManifest, ManifestFrameworkContract } from './schema'

function renderContractDetails(contract: ManifestFrameworkContract): string[] {
  const details: string[] = []
  if (contract.props.length) {
    details.push(
      `props ${contract.props.map((p) => `${p.name}${p.optional ? '?' : ''}`).join(', ')}`,
    )
  } else if (contract.propsSource === 'intrinsic-spread' && contract.intrinsicAttributes) {
    // An empty `props` array here means "nothing enumerable", NOT "accepts
    // nothing". Saying so explicitly stops an agent from calling the component
    // with no attributes.
    details.push(
      `props (all of ${contract.intrinsicAttributes} — forwards the whole attribute set; ` +
        `the list is not enumerable, do NOT treat as prop-less)`,
    )
  }
  if (contract.events.length) details.push(`events ${contract.events.join(', ')}`)
  if (contract.slots.length) details.push(`slots ${contract.slots.join(', ')}`)
  if (contract.publicTypes.length) details.push(`types ${contract.publicTypes.join(', ')}`)
  return details
}

function renderComponentContracts(
  component: IrisManifest['components'][number],
  lines: string[],
): void {
  for (const framework of component.frameworks) {
    const contract = component.frameworkContracts?.[framework]
    if (!contract) continue
    const details = renderContractDetails(contract)
    if (details.length) lines.push(`  ${framework}: ${details.join('; ')}`)
  }
}

function renderComponentQuality(
  component: IrisManifest['components'][number],
  lines: string[],
): void {
  if ((component as { quality?: { propCount?: number; eventCount?: number } }).quality) {
    const q = (component as { quality: { propCount?: number; eventCount?: number } }).quality
    const badges: string[] = []
    if (q.propCount != null) badges.push(`${q.propCount} props`)
    if (q.eventCount != null) badges.push(`${q.eventCount} events`)
    if (badges.length > 0) lines.push(`  quality: ${badges.join(', ')}`)
  }
}

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
  renderComponentContracts(component, lines)
  renderComponentQuality(component, lines)
}

/**
 * Render the manifest as `llms.txt` — a compact, human- and LLM-readable
 * inventory a downstream project can drop into its own AGENTS.md so an agent
 * knows which components exist, where to import them, and which design tokens
 * are available.
 */
/** Plugin descriptions indexed by npm package name. */
const PLUGIN_DESCRIPTIONS: Record<string, string> = {
  'plugin-locale-zh': 'Simplified-Chinese (zh-CN) message pack for all Iris UI i18n keys.',
  'plugin-editor': 'CodeMirror 6 code editor (SQL/JSON/JS/plain) with inline diff view.',
  'plugin-pro-table':
    'vxe-table-style CRUD data table with sorting, filtering, inline editing, column resize, and row virtualization.',
  'plugin-charts': 'Zero-dependency, token-themed SVG charts: line, area, bar, sparkline.',
  'plugin-form-builder':
    'Schema-driven form builder — render a validated form from a declarative schema.',
  'plugin-notifications':
    'Persistent notification center with inbox, unread count, mark-read, dismiss.',
  'plugin-admin': 'Admin panel extensions: page layouts, user management widgets.',
  'plugin-calendar': 'Calendar widget with month/week views and event display.',
  'plugin-dashboard': 'Dashboard grid layouts with draggable cards and responsive breakpoints.',
  'plugin-kanban': 'Kanban board with drag-and-drop columns and cards.',
  'plugin-markdown': 'Markdown editor (CodeMirror) and rendered preview with syntax highlighting.',
  'plugin-query-builder':
    'Visual query/filter builder with rule groups, operators, and value inputs.',
}

function renderManifestHeader(manifest: IrisManifest, lines: string[]): void {
  lines.push(`# ${manifest.name}`, '', manifest.description, '')
  lines.push(
    `Frameworks: ${manifest.frameworks.join(', ')}. Import components from ` +
      manifest.frameworks.map((framework) => '`@iris-ui-kit/' + framework + '`').join(' or ') +
      '.',
    '',
    '## Architecture',
  )
  for (const layer of manifest.layerModel) lines.push('- ' + layer.layer + ': ' + layer.description)
  lines.push('')
}

function renderResilienceSection(lines: string[]): void {
  lines.push('## Data & Resilience Primitives (framework-agnostic, from @iris-ui-kit/core)')
  lines.push(
    '- `createDisposableScope` — Lifecycle teardown (destroy, child scopes, error isolation).',
    '- `createEventBus` — Typed pub/sub for cross-plugin and cross-controller communication.',
    '- `createQueryCache` — Async fetch dedup with TTL + stale-while-revalidate (SWR).',
    '- `createCircuitBreaker` — Failure isolation: trips after N failures, resets after cooldown.',
    '- `createRateLimiter` — Token-bucket rate limiting with burst capacity.',
    '- `createResilientFetcher` — Composes cache + circuit breaker + rate limiter into one hardened async fetcher.',
    '- `createOutbox` — Offline-first, durable FIFO mutation queue with at-least-once delivery.',
    '- `createReconnectingSource` — Realtime push transport with exponential-backoff reconnection.',
    '- `createDataSource` — Unified data engine: fetch + paginate + sort + filter + select + mutate. Optionally wraps resilient fetcher and outbox.',
    '- `createResourceController` — Higher-level CRUD list controller (Table/ProTable).',
    '',
  )
}

function renderPluginSection(manifest: IrisManifest, lines: string[]): void {
  lines.push(
    '## Plugin Ecosystem (12 plugins)',
    'Install plugins as separate packages; activate via <IrisProvider plugins={[…]}>.',
    'Import components from `@iris-ui-kit/plugin-{name}/{framework}`.',
  )
  for (const [pkg, description] of Object.entries(PLUGIN_DESCRIPTIONS)) {
    const count = manifest.components.filter((component) => component.plugin === pkg).length
    const suffix = count > 0 ? ` (${count} components)` : ''
    lines.push(`- \`@iris-ui-kit/${pkg}\`${suffix} — ${description}`)
  }
  lines.push('')
}

function renderParitySection(manifest: IrisManifest, lines: string[]): void {
  const parity = manifest.stats.parity
  if (!parity) return
  const fws = manifest.frameworks
  lines.push('## Cross-framework parity (READ BEFORE generating code)')
  lines.push(parity.caveat)
  lines.push(
    `- Of ${parity.identical + parity.nearIdentical + parity.divergent + parity.incomparable} ` +
      `comparable components: ${parity.identical} have identical prop names in all ` +
      `${fws.length} frameworks, ${parity.nearIdentical} are near-identical, ` +
      `${parity.divergent} diverge.` +
      (parity.incomparable > 0 ? ` ${parity.incomparable} could not be compared.` : ''),
  )
  if (parity.intrinsicSpread > 0) {
    lines.push(
      `- ${parity.intrinsicSpread} components are excluded from those counts because at least ` +
        `one adapter forwards its whole HTML attribute set (contract \`propsSource: ` +
        `"intrinsic-spread"\`), so its prop list is not enumerable. An empty \`props\` array ` +
        `there does NOT mean the component accepts no attributes — read ` +
        `\`intrinsicAttributes\`.`,
    )
  }
  lines.push(
    `- Mean shared prop names: ${Math.round(parity.meanRatio * 100)}% (lowest ` +
      `${Math.round(parity.minRatio * 100)}%).`,
  )
  lines.push(
    `- Prop declarations per framework: ` +
      fws.map((f) => `${f} ${parity.propTotals[f]}`).join(', ') +
      '.',
  )
  lines.push(
    `- Prop names declared by exactly one framework (capability that exists on one ` +
      `adapter only): ` +
      fws.map((f) => `${f} ${parity.exclusivePropNames[f]}`).join(', ') +
      '.',
  )
  if (parity.maxAsymmetry) {
    const widest = parity.maxAsymmetry
    lines.push(
      `- Widest surface gap: \`${widest.name}\` — ${widest.ratio}x ` +
        `(${fws.map((f) => `${f} ${widest.byFramework[f]}`).join(', ')} props).`,
    )
  }
  if (parity.worst.length > 0) {
    lines.push('- Most divergent components (shared/union prop names):')
    for (const row of parity.worst) {
      lines.push(
        `  - \`${row.name}\` ${Math.round(row.ratio * 100)}% shared — ` +
          `${fws.map((f) => `${f} ${row.byFramework[f]}`).join(', ')}` +
          (row.uniqueTo.react?.length
            ? `; react-only: ${row.uniqueTo.react.slice(0, 8).join(', ')}` +
              (row.uniqueTo.react.length > 8 ? `, +${row.uniqueTo.react.length - 8} more` : '')
            : ''),
      )
    }
  }
  lines.push('')
}

function renderComponentSection(manifest: IrisManifest, lines: string[]): void {
  const byFramework = manifest.frameworks
    .map((framework) => framework + ' ' + String(manifest.stats.byFramework[framework]))
    .join(', ')
  lines.push(
    '## Components (' +
      manifest.stats.total +
      ' total — ' +
      manifest.stats.full +
      ' in all ' +
      manifest.frameworks.length +
      ' frameworks; ' +
      byFramework +
      ')',
  )
  for (const group of manifest.groups) {
    lines.push('', '### ' + group.group + ' (' + group.count + ')')
    for (const name of group.components) {
      const component = manifest.components.find((entry) => entry.name === name)
      if (component) renderComponentLines(component, lines)
    }
  }
  lines.push('')
}

function renderTokenSection(manifest: IrisManifest, lines: string[]): void {
  lines.push(
    '## Design tokens (' + manifest.tokens.all.length + ')',
    '- colors: ' + manifest.tokens.color.join(', '),
    '- spacing: ' + manifest.tokens.spacing.join(', '),
    '- radii: ' + manifest.tokens.radii.join(', '),
    '- shadows: ' + manifest.tokens.shadows.join(', '),
    '- z-index: ' + manifest.tokens.zIndex.join(', '),
    '- transitions: ' + manifest.tokens.transitions.join(', '),
    '',
  )
}

export function renderLlmsText(manifest: IrisManifest): string {
  const lines: string[] = []
  renderManifestHeader(manifest, lines)
  renderResilienceSection(lines)
  renderPluginSection(manifest, lines)
  renderParitySection(manifest, lines)
  renderComponentSection(manifest, lines)
  renderTokenSection(manifest, lines)
  return lines.join('\n')
}
