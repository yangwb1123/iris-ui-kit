import { describe, expect, it } from 'vitest'
import { buildManifest } from './build'
import { renderLlmsText } from './llms'
import { discover, findRepoRoot } from './discover'
import { classifyProps } from './props'
import type { ManifestProp, RawDiscovery } from './schema'

const sample: RawDiscovery = {
  components: [
    { name: 'IrisButton', group: 'primitives', module: 'button', frameworks: ['react', 'vue'] },
    { name: 'IrisAlert', group: 'primitives', module: 'alert', frameworks: ['react'] },
    { name: 'IrisStack', group: 'layouts', frameworks: ['vue'] },
  ],
  tokens: {
    color: ['iris.primary'],
    spacing: ['iris.gap.md'],
    radii: ['iris.radius.sm'],
    shadows: ['iris.shadow.sm'],
    zIndex: ['iris.z.dropdown'],
    transitions: ['iris.transition.fast'],
  },
}

describe('buildManifest', () => {
  it('sorts components and merges frameworks + importFrom', () => {
    const m = buildManifest(sample)
    expect(m.components.map((c) => c.name)).toEqual(['IrisAlert', 'IrisButton', 'IrisStack'])
    const button = m.components.find((c) => c.name === 'IrisButton')
    expect(button?.frameworks).toEqual(['react', 'vue'])
    expect(button?.importFrom).toEqual({ react: '@iris-ui-kit/react', vue: '@iris-ui-kit/vue' })
  })

  it('computes per-framework stats', () => {
    expect(buildManifest(sample).stats).toEqual({
      total: 3,
      full: 0,
      byFramework: { react: 2, vue: 2, solid: 0, svelte: 0 },
    })
  })

  it('groups components and flattens the token catalog', () => {
    const m = buildManifest(sample)
    const primitives = m.groups.find((g) => g.group === 'primitives')
    expect(primitives?.count).toBe(2)
    expect(primitives?.components).toEqual(['IrisAlert', 'IrisButton'])
    expect(m.tokens.all).toEqual([
      'iris.primary',
      'iris.gap.md',
      'iris.radius.sm',
      'iris.shadow.sm',
      'iris.z.dropdown',
      'iris.transition.fast',
    ])
  })

  it('is deterministic', () => {
    expect(JSON.stringify(buildManifest(sample))).toBe(JSON.stringify(buildManifest(sample)))
  })
})

describe('renderLlmsText', () => {
  it('includes header, sections, components and tokens', () => {
    const text = renderLlmsText(buildManifest(sample))
    expect(text).toContain('# Iris UI')
    expect(text).toContain('## Architecture')
    expect(text).toContain('## Components (3 total')
    expect(text).toContain('- IrisButton [react/vue]')
    expect(text).toContain('iris.primary')
  })
})

describe('discover (real repo)', () => {
  it('locates the workspace root', () => {
    expect(() => findRepoRoot()).not.toThrow()
  })

  it('discovers class-based components (React IrisErrorBoundary) in all 4 frameworks', () => {
    // React authors IrisErrorBoundary as `export class` — the discovery regex
    // must match `class`, not only const/function, or react drops out of parity.
    const m = buildManifest(discover())
    const eb = m.components.find((c) => c.name === 'IrisErrorBoundary')
    expect(eb?.frameworks.slice().sort()).toEqual(['react', 'solid', 'svelte', 'vue'])
  })

  it('discovers the real inventory from all adapters', () => {
    const raw = discover()
    const button = raw.components.find((c) => c.name === 'IrisButton')
    expect(button?.frameworks.slice().sort()).toEqual(['react', 'solid', 'svelte', 'vue'])
    expect(raw.components.length).toBeGreaterThan(80)
    expect(raw.tokens.color).toContain('iris.primary')
    expect(raw.tokens.spacing).toContain('iris.gap.md')
    expect(raw.tokens.radii).toContain('iris.radius.sm')
    expect(raw.tokens.shadows).toContain('iris.shadow.sm')
    expect(raw.tokens.zIndex).toContain('iris.z.dropdown')
    expect(raw.tokens.transitions).toContain('iris.transition.fast')
  })

  it('builds a clean manifest from the real repo', () => {
    const m = buildManifest(discover())
    expect(m.stats.total).toBe(m.components.length)
    expect(m.components.every((c) => c.frameworks.length >= 1)).toBe(true)
    // The non-component filter kept injection keys / contexts out.
    expect(m.components.some((c) => /Key$|Context$/.test(c.name))).toBe(false)
  })

  it('enforces 4-framework parity: EVERY component exists in react+vue+solid+svelte', () => {
    // The library's core invariant. Catches the #1 regression — a component
    // added to one framework but not mirrored to the other three. If a genuinely
    // framework-specific component is ever introduced, allow-list it here.
    const ALL = ['react', 'solid', 'svelte', 'vue']
    const m = buildManifest(discover())
    const offParity = m.components
      .filter((c) => c.frameworks.slice().sort().join(',') !== ALL.join(','))
      .map((c) => `${c.name} [${c.frameworks.slice().sort().join('/')}]`)
    expect(offParity).toEqual([])
  })

  it('discovers plugin components tagged with their owning package + sub-path import', () => {
    const m = buildManifest(discover())
    const editor = m.components.find((c) => c.name === 'IrisCodeEditor')
    expect(editor?.group).toBe('plugin')
    expect(editor?.plugin).toBe('@iris-ui-kit/plugin-editor')
    expect(editor?.importFrom.react).toBe('@iris-ui-kit/plugin-editor/react')
    const proTable = m.components.find((c) => c.name === 'IrisProTable')
    expect(proTable?.plugin).toBe('@iris-ui-kit/plugin-pro-table')
    // llms.txt surfaces the activation hint for plugin components.
    const llms = renderLlmsText(m)
    expect(llms).toContain('via @iris-ui-kit/plugin-editor')
    // All four sub-path imports are present.
    expect(editor?.importFrom.vue).toBe('@iris-ui-kit/plugin-editor/vue')
    expect(editor?.importFrom.solid).toBe('@iris-ui-kit/plugin-editor/solid')
    expect(editor?.importFrom.svelte).toBe('@iris-ui-kit/plugin-editor/svelte')
  })

  it('discovers IrisFormBuilder and all other plugin components across every plugin package', () => {
    const m = buildManifest(discover())
    const pluginComponents = m.components.filter((c) => c.group === 'plugin')
    // All 9 plugin components (admin, charts×3, editor, form-builder, notifications,
    // pro-table, query-builder) should be discoverable.
    expect(pluginComponents.length).toBeGreaterThanOrEqual(9)

    // IrisFormBuilder — recently extended with async validation + debounce.
    const formBuilder = m.components.find((c) => c.name === 'IrisFormBuilder')
    expect(formBuilder?.group).toBe('plugin')
    expect(formBuilder?.plugin).toBe('@iris-ui-kit/plugin-form-builder')
    expect(formBuilder?.importFrom.react).toBe('@iris-ui-kit/plugin-form-builder/react')
    expect(formBuilder?.importFrom.vue).toBe('@iris-ui-kit/plugin-form-builder/vue')
    expect(formBuilder?.importFrom.solid).toBe('@iris-ui-kit/plugin-form-builder/solid')
    expect(formBuilder?.importFrom.svelte).toBe('@iris-ui-kit/plugin-form-builder/svelte')
    expect(formBuilder?.frameworks.slice().sort()).toEqual(['react', 'solid', 'svelte', 'vue'])

    // Charts package exports the complete chart family under one plugin.
    const charts = pluginComponents.filter((c) => c.plugin === '@iris-ui-kit/plugin-charts')
    expect(charts.map((c) => c.name).sort()).toEqual([
      'IrisBarChart',
      'IrisDonutChart',
      'IrisLineChart',
      'IrisMultiLineChart',
      'IrisSparkline',
      'IrisStackedBarChart',
    ])

    // Every plugin component carries an activation hint in llms.txt.
    const llms = renderLlmsText(m)
    for (const c of pluginComponents) {
      expect(llms).toContain(`via ${c.plugin}`)
    }
  })

  it('renders events and slots in llms.txt for components that have them', () => {
    const m = buildManifest(discover())
    const llms = renderLlmsText(m)
    // At least one component has events/slots rendered.
    // IrisButton has onClick; Dialog-family has slots.
    expect(llms).toMatch(/events /)
    expect(llms).toMatch(/slots /)
  })

  it('extracts typed props from component interfaces (name/type/optional/JSDoc)', () => {
    const m = buildManifest(discover())
    const button = m.components.find((c) => c.name === 'IrisButton')
    expect(button?.props).toBeDefined()
    const variant = button?.props?.find((p) => p.name === 'variant')
    expect(variant?.optional).toBe(true)
    expect(variant?.type).toBe('IrisButtonVariant')
    // a meaningful fraction of components carry props (not just one)
    expect(m.components.filter((c) => (c.props?.length ?? 0) > 0).length).toBeGreaterThan(40)
    // methods / index signatures are not captured as props
    expect(button?.props?.some((p) => p.name.includes('('))).toBe(false)
  })

  it('enumerates string-literal-union prop values, resolving through type aliases', () => {
    const m = buildManifest(discover())
    const button = m.components.find((c) => c.name === 'IrisButton')
    // variant is `IrisButtonVariant` → `Variant` (in core) → a string union;
    // the resolver follows the alias chain to the literal values.
    const variant = button?.props?.find((p) => p.name === 'variant')
    expect(variant?.enum).toEqual(['solid', 'outline', 'ghost', 'link'])
    const size = button?.props?.find((p) => p.name === 'size')
    expect(size?.enum).toEqual(['sm', 'md', 'lg'])
    // non-enumerable types carry no `enum`.
    const children = button?.props?.find((p) => p.name === 'children')
    expect(children?.enum).toBeUndefined()
    // a meaningful number of props across the library are enumerated.
    const enumProps = m.components.flatMap((c) => c.props ?? []).filter((p) => p.enum)
    expect(enumProps.length).toBeGreaterThan(30)
  })

  it('captures literal default values from the component destructuring', () => {
    const m = buildManifest(discover())
    const admin = m.components.find((c) => c.name === 'IrisAdminLayout')
    const mode = admin?.props?.find((p) => p.name === 'mode')
    // mode carries the full contract: type + enum + default.
    expect(mode?.default).toBe('sidebar')
    expect(mode?.enum).toEqual(['sidebar', 'horizontal', 'full-content'])
    // booleans are captured too.
    const collapsed = admin?.props?.find((p) => p.name === 'defaultCollapsed')
    expect(collapsed?.default).toBe('false')
    // a meaningful number of props across the library carry a default.
    const withDefaults = m.components
      .flatMap((c) => c.props ?? [])
      .filter((p) => p.default !== undefined)
    expect(withDefaults.length).toBeGreaterThan(100)
  })

  it('harvests per-component descriptions from leading JSDoc (React reference source)', () => {
    const m = buildManifest(discover())
    // Flagship components carry a prose summary harvested from their JSDoc.
    const select = m.components.find((c) => c.name === 'IrisSelect')
    expect(select?.description).toContain('Single-select dropdown')
    const dialog = m.components.find((c) => c.name === 'IrisDialog')
    expect(dialog?.description).toMatch(/dialog/i)
    // A meaningful majority of components end up described (never fabricated;
    // components with no leading JSDoc simply get none).
    const described = m.components.filter((c) => c.description && c.description.length > 0)
    expect(described.length).toBeGreaterThan(100)
    // Descriptions are single-line (whitespace-collapsed), never multi-line.
    expect(described.every((c) => !c.description!.includes('\n'))).toBe(true)
  })

  it('harvests the @example snippet when present, into the component example field', () => {
    const m = buildManifest(discover())
    const tooltip = m.components.find((c) => c.name === 'IrisTooltip')
    expect(tooltip?.example).toContain('<IrisTooltip')
    // Code-fence markers are stripped from harvested examples.
    expect(tooltip?.example).not.toContain('```')
  })

  it('surfaces component descriptions in llms.txt', () => {
    const m = buildManifest(discover())
    const llms = renderLlmsText(m)
    expect(llms).toContain('Single-select dropdown')
  })

  it('detects compound sub-components by the part-suffix naming convention', () => {
    const m = buildManifest(discover())
    const dialog = m.components.find((c) => c.name === 'IrisDialog')
    expect(dialog?.subComponents).toContain('IrisDialogContent')
    expect(dialog?.subComponents).toContain('IrisDialogTrigger')
    // distinct-component lookalikes that merely share a prefix are NOT parts.
    expect(m.components.find((c) => c.name === 'IrisProgress')?.subComponents).toBeUndefined()
    expect(m.components.find((c) => c.name === 'IrisTree')?.subComponents).toBeUndefined()
  })
})

describe('classifyProps', () => {
  it('classifies on[A-Z] props as events', () => {
    const props: ManifestProp[] = [
      { name: 'onClick', type: '() => void', optional: true },
      { name: 'onValueChange', type: '(v: string) => void', optional: true },
      { name: 'label', type: 'string', optional: false },
    ]
    const { events, slots } = classifyProps(props)
    expect(events).toEqual(['onClick', 'onValueChange'])
    expect(slots).toEqual([])
  })

  it('classifies ReactNode props as slots, normalising children → default', () => {
    const props: ManifestProp[] = [
      { name: 'children', type: 'React.ReactNode', optional: true },
      { name: 'trigger', type: 'ReactNode', optional: true },
      { name: 'label', type: 'string', optional: false },
    ]
    const { events, slots } = classifyProps(props)
    expect(events).toEqual([])
    expect(slots).toEqual(['default', 'trigger'])
  })

  it('deduplicates slot names', () => {
    const props: ManifestProp[] = [
      { name: 'children', type: 'React.ReactNode', optional: true },
      { name: 'children', type: 'ReactNode', optional: true },
    ]
    const { slots } = classifyProps(props)
    expect(slots).toEqual(['default'])
  })

  it('returns empty arrays when no events or slots found', () => {
    const props: ManifestProp[] = [
      { name: 'size', type: "'sm' | 'md' | 'lg'", optional: true },
      { name: 'disabled', type: 'boolean', optional: true },
    ]
    const { events, slots } = classifyProps(props)
    expect(events).toEqual([])
    expect(slots).toEqual([])
  })
})
