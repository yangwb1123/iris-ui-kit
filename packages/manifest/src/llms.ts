import type { IrisManifest } from './schema'

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

  lines.push('## Data & Resilience Primitives (framework-agnostic, from @iris-ui/core)')
  lines.push(
    '- `createDisposableScope` — Lifecycle teardown (destroy, child scopes, error isolation).',
  )
  lines.push(
    '- `createEventBus` — Typed pub/sub for cross-plugin and cross-controller communication.',
  )
  lines.push('- `createQueryCache` — Async fetch dedup with TTL + stale-while-revalidate (SWR).')
  lines.push(
    '- `createCircuitBreaker` — Failure isolation: trips after N failures, resets after cooldown.',
  )
  lines.push('- `createRateLimiter` — Token-bucket rate limiting with burst capacity.')
  lines.push(
    '- `createResilientFetcher` — Composes cache + circuit breaker + rate limiter into one hardened async fetcher.',
  )
  lines.push(
    '- `createOutbox` — Offline-first, durable FIFO mutation queue with at-least-once delivery.',
  )
  lines.push(
    '- `createReconnectingSource` — Realtime push transport with exponential-backoff reconnection.',
  )
  lines.push(
    '- `createDataSource` — Unified data engine: fetch + paginate + sort + filter + select + mutate. Optionally wraps resilient fetcher and outbox.',
  )
  lines.push('- `createResourceController` — Higher-level CRUD list controller (Table/ProTable).')
  lines.push('')
  lines.push('## Plugin Ecosystem (12 plugins)')
  lines.push('Install plugins as separate packages; activate via <IrisProvider plugins={[…]}>.')
  lines.push('Import components from `@iris-ui/plugin-{name}/{framework}`.')
  for (const [pkg, desc] of Object.entries(PLUGIN_DESCRIPTIONS)) {
    const maybe = manifest.components.filter((c) => c.plugin === pkg)
    const tail = maybe.length > 0 ? ` (${maybe.length} components)` : ''
    lines.push(`- \`@iris-ui/${pkg}\`${tail} — ${desc}`)
  }
  lines.push('')

  const byFw = manifest.frameworks.map((f) => `${f} ${manifest.stats.byFramework[f]}`).join(', ')
  lines.push(
    `## Components (${manifest.stats.total} total — ${manifest.stats.full} in all ` +
      `${manifest.frameworks.length} frameworks; ${byFw})`,
  )
  for (const group of manifest.groups) {
    lines.push('')
    lines.push(`### ${group.group} (${group.count})`)
    for (const name of group.components) {
      const component = manifest.components.find((c) => c.name === name)
      const fw = component ? component.frameworks.join('/') : ''
      // Plugin components note their package so an agent knows to install it and
      // activate via `<IrisProvider plugins={[…]}>`.
      const via = component?.plugin ? ` — via ${component.plugin} (IrisProvider plugins)` : ''
      lines.push(`- ${name} [${fw}]${via}`)
      // The component's harvested JSDoc summary, so an agent reading llms.txt
      // knows what each component is for (full prose + @example live in
      // manifest.json). Rendered on its own indented line below the header.
      if (component?.description) {
        lines.push(`  ${component.description}`)
      }
      // Compact prop list (names + `?` for optional) so an agent reading
      // llms.txt knows the API surface; full types live in manifest.json.
      if (component?.props && component.props.length > 0) {
        const names = component.props.map((p) => `${p.name}${p.optional ? '?' : ''}`).join(', ')
        lines.push(`  props: ${names}`)
      }
      if (component?.events && component.events.length > 0) {
        lines.push(`  events: ${component.events.join(', ')}`)
      }
      if (component?.slots && component.slots.length > 0) {
        lines.push(`  slots: ${component.slots.join(', ')}`)
      }
      if (component?.quality) {
        const badges: string[] = []
        if (component.quality.propCount != null) badges.push(`${component.quality.propCount} props`)
        if (component.quality.eventCount != null)
          badges.push(`${component.quality.eventCount} events`)
        if (badges.length > 0) lines.push(`  quality: ${badges.join(', ')}`)
      }
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
