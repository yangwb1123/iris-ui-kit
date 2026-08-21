import type { IrisManifest, ManifestFrameworkContract } from './schema'

function renderContractDetails(contract: ManifestFrameworkContract): string[] {
  const details: string[] = []
  if (contract.props.length) {
    details.push(
      `props ${contract.props.map((p) => `${p.name}${p.optional ? '?' : ''}`).join(', ')}`,
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
  renderComponentSection(manifest, lines)
  renderTokenSection(manifest, lines)
  return lines.join('\n')
}
