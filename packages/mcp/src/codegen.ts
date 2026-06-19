import type { Framework, IrisManifest, ManifestComponent, ManifestProp } from '@iris-ui/manifest'
import { dataStub, dataWiringKind } from './codegen-stubs'

/**
 * Deterministic, template-driven codegen over the typed {@link IrisManifest}.
 *
 * The manifest is the grounding asset: every component carries its React-derived
 * prop contract (name / type / optional / enum / default) plus its events. From
 * that we can emit WIRED views — real state scaffolding for controlled
 * components and a runnable-against-stub data wiring for data components — per
 * framework, with NO LLM call. Pure functions of `(manifest, intent)`, so the
 * same input always yields the same output.
 *
 * This module owns the wiring rules; `tools.ts` composes them into the MCP
 * tool bodies (`scaffold_component`, `generate_view`, `generate_test`).
 */

/* -------------------------------------------------------------------------- */
/* Controlled-pair detection                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A controlled value/handler prop pair discovered on a component, e.g.
 * `value` + `onValueChange`, `checked` + `onChange`, `open` + `onOpenChange`.
 * The local variable name we bind the state to is derived from the value prop.
 */
export interface ControlledPair {
  /** The value prop name (e.g. `value`, `checked`, `open`). */
  value: string
  /** The change-handler prop name (e.g. `onValueChange`, `onChange`). */
  handler: string
  /** The value prop's declared type. */
  type: string
  /** The literal default to seed the state with (already framework-neutral). */
  default: string
  /** Local binding name: the value prop unless it is the generic `value`. */
  local: string
}

/**
 * Candidate controlled value props in priority order. The first one present on a
 * component (with a matching handler) wins — a component is wired around a single
 * primary controlled value. `value`/`checked`/`open` cover the bulk of the
 * library's controlled primitives (Select, Switch/Checkbox, Dialog/Popover, …).
 */
const VALUE_PROP_PRIORITY = [
  'value',
  'checked',
  'open',
  'selected',
  'pressed',
  'expanded',
  'active',
  'page',
]

/** The handler that controls `valueProp`, if it exists in `props`/`events`. */
function handlerFor(valueProp: string, names: Set<string>): string | undefined {
  // `value` → `onValueChange`, `checked` → `onCheckedChange`, etc.
  const specific = `on${valueProp[0]!.toUpperCase()}${valueProp.slice(1)}Change`
  if (names.has(specific)) return specific
  // Several controls (Switch, Checkbox) expose the generic `onChange` instead.
  if (names.has('onChange')) return 'onChange'
  return undefined
}

/** A sensible literal seed for a state of declared `type`, honoring an enum/default. */
function seedFor(prop: ManifestProp): string {
  if (prop.default !== undefined) return prop.default
  if (prop.enum && prop.enum.length > 0) return `'${prop.enum[0]}'`
  const t = prop.type.toLowerCase()
  if (t === 'boolean' || /\bboolean\b/.test(t)) return 'false'
  if (t === 'number' || /\bnumber\b/.test(t)) return '0'
  if (t === 'string' || /\bstring\b/.test(t)) return "''"
  return 'undefined'
}

/**
 * Find the component's primary controlled value/handler pair from the manifest
 * prop names, or null if it has none (e.g. a purely uncontrolled / native input).
 */
export function detectControlledPair(component: ManifestComponent): ControlledPair | null {
  const props = component.props ?? []
  const propNames = new Set(props.map((p) => p.name))
  // Handlers may be surfaced on `events` even if also in `props`.
  const names = new Set<string>([...propNames, ...(component.events ?? [])])

  for (const valueName of VALUE_PROP_PRIORITY) {
    if (!propNames.has(valueName)) continue
    const handler = handlerFor(valueName, names)
    if (!handler) continue
    const prop = props.find((p) => p.name === valueName)!
    const local = valueName === 'value' ? 'value' : valueName
    return {
      value: valueName,
      handler,
      type: prop.type,
      default: seedFor(prop),
      local,
    }
  }
  return null
}

/**
 * Return `pair` with a `local` (state var) name unique within `used`, recording
 * the chosen name. Composing several `value`-controlled components would
 * otherwise re-declare `value`; collisions get a numeric suffix (`value2`, …).
 * Mutates `used`. A null pair (or a stub-owned binding) is passed through.
 */
function uniqueLocal(pair: ControlledPair | null, used: Set<string>): ControlledPair | null {
  if (!pair) return null
  if (!used.has(pair.local)) {
    used.add(pair.local)
    return pair
  }
  let i = 2
  while (used.has(`${pair.local}${i}`)) i += 1
  const local = `${pair.local}${i}`
  used.add(local)
  return { ...pair, local }
}

/* -------------------------------------------------------------------------- */
/* Required non-controlled prop fill                                          */
/* -------------------------------------------------------------------------- */

/**
 * Required props excluding the controlled pair (bound to state) and any props a
 * data stub already owns (e.g. a Select's `items`, a Tree's `nodes`) — those are
 * bound from the stub, so we must not also emit a placeholder fill for them.
 */
function otherRequiredProps(
  component: ManifestComponent,
  pair: ControlledPair | null,
  owned: ReadonlySet<string> = EMPTY_OWNED,
): ManifestProp[] {
  return (component.props ?? []).filter(
    (p) => !p.optional && p.name !== pair?.value && p.name !== pair?.handler && !owned.has(p.name),
  )
}

/** Shared empty owned-prop set (no allocation on the common no-stub path). */
const EMPTY_OWNED: ReadonlySet<string> = new Set()

/** The literal to put for a required non-controlled prop: its default else a typed placeholder. */
function fillValue(prop: ManifestProp): { literal: string; isPlaceholder: boolean } {
  if (prop.default !== undefined) return { literal: prop.default, isPlaceholder: false }
  if (prop.enum && prop.enum.length > 0)
    return { literal: `'${prop.enum[0]}'`, isPlaceholder: false }
  return { literal: `/* ${prop.type} */`, isPlaceholder: true }
}

/* -------------------------------------------------------------------------- */
/* Per-framework state scaffolding                                            */
/* -------------------------------------------------------------------------- */

/**
 * The state-declaration line for a controlled pair in `framework`. A
 * `seedOverride` (e.g. a data stub's concrete `new Date(...)`) takes precedence
 * over the pair's generic typed default.
 */
function stateDecl(pair: ControlledPair, framework: Framework, seedOverride?: string): string {
  const { local } = pair
  const seed = seedOverride ?? pair.default
  const setter = `set${local[0]!.toUpperCase()}${local.slice(1)}`
  switch (framework) {
    case 'react':
      return `const [${local}, ${setter}] = React.useState(${seed})`
    case 'solid':
      return `const [${local}, ${setter}] = createSignal(${seed})`
    case 'svelte':
      return `let ${local} = $state(${seed})`
    case 'vue':
      return `const ${local} = ref(${seed})`
  }
}

/** The state import line for `framework` (the hook/primitive used by {@link stateDecl}). */
function stateImport(framework: Framework): string | null {
  switch (framework) {
    case 'react':
      return "import * as React from 'react'"
    case 'solid':
      return "import { createSignal } from 'solid-js'"
    case 'vue':
      return "import { ref } from 'vue'"
    case 'svelte':
      // `$state` is a Svelte 5 rune — no import.
      return null
  }
}

/**
 * The opening attribute string for the controlled binding in `framework`.
 * React/Solid pass `value={value} onValueChange={setValue}`; Solid reads the
 * signal as a call (`value()`); Vue uses `v-model` (the idiomatic mapping of a
 * React `value`+`onValueChange` pair); Svelte uses `bind:`.
 */
function controlledBinding(pair: ControlledPair, framework: Framework): string {
  const { value, handler, local } = pair
  const setter = `set${local[0]!.toUpperCase()}${local.slice(1)}`
  switch (framework) {
    case 'react':
      return `${value}={${local}} ${handler}={${setter}}`
    case 'solid':
      return `${value}={${local}()} ${handler}={${setter}}`
    case 'svelte':
      return `bind:${value}={${local}}`
    case 'vue':
      // Vue adapters expose v-model; bind the primary value through it.
      return value === 'value' ? `v-model="${local}"` : `v-model:${value}="${local}"`
  }
}

/** A non-controlled required-prop attribute in `framework` syntax. */
function fillAttr(prop: ManifestProp, framework: Framework): string {
  const { literal, isPlaceholder } = fillValue(prop)
  if (framework === 'vue') {
    // String literals bind statically without `:`; everything else is a JS expr.
    if (!isPlaceholder && /^'.*'$/.test(literal))
      return `${prop.name}=${literal.replace(/'/g, '"')}`
    return `:${prop.name}="${isPlaceholder ? `/* ${prop.type} */` : literal}"`
  }
  return `${prop.name}={${literal}}`
}

/* -------------------------------------------------------------------------- */
/* Single-component wired snippet                                             */
/* -------------------------------------------------------------------------- */

/**
 * The element/tag for a wired component, no import. Composes, in order:
 *  - `dataBind`: a leading attribute string from a data stub (e.g. `nodes={…}`),
 *  - the controlled binding (when `pair` is present and the stub doesn't own it),
 *  - placeholder fills for the remaining required props (minus stub-owned ones).
 */
export function wiredTag(
  component: ManifestComponent,
  framework: Framework,
  pair: ControlledPair | null,
  dataBind = '',
  owned: ReadonlySet<string> = EMPTY_OWNED,
): string {
  const { name } = component
  const attrs: string[] = []
  if (dataBind) attrs.push(dataBind)
  // Skip the controlled binding when the stub already owns its value prop.
  if (pair && !owned.has(pair.value)) attrs.push(controlledBinding(pair, framework))
  for (const p of otherRequiredProps(component, pair, owned)) attrs.push(fillAttr(p, framework))
  const attrStr = attrs.length ? ' ' + attrs.join(' ') : ''
  if (framework === 'vue') return `<${name}${attrStr} />`
  return `<${name}${attrStr}></${name}>`
}

/* -------------------------------------------------------------------------- */
/* Composed view                                                              */
/* -------------------------------------------------------------------------- */

export interface GenerateViewRequest {
  framework: Framework
  /** Component names to compose into the view, in order. */
  components: string[]
  /** Optional container/layout component to wrap the children. */
  layout?: string
}

/**
 * Compose a WIRED, runnable-against-stub view from the intent (`components`,
 * optional `layout`) for `framework`:
 *  - deduped imports grouped by source module (+ the framework state import +
 *    any data-stub imports),
 *  - a setup block: `useState`/`ref`/`signal`/`$state` for each controlled
 *    component, and a data stub (`createProTableStore` / form `schema`) for each
 *    data component,
 *  - markup binding each component to its state / stub.
 *
 * Deterministic from `(manifest, request)`. Returns null when `components` is
 * empty or any named component is unknown / unsupported in `framework`.
 */
export function generateView(manifest: IrisManifest, req: GenerateViewRequest): string | null {
  const { framework, components, layout } = req
  if (components.length === 0) return null
  const names = layout ? [layout, ...components] : components
  const resolved = names.map((n) => manifest.components.find((c) => c.name === n) ?? null)
  if (resolved.some((c) => !c || !c.frameworks.includes(framework))) return null

  // Component imports, deduped + grouped by source module.
  const byPath = new Map<string, Set<string>>()
  const pluginNotes: string[] = []
  for (const c of resolved as ManifestComponent[]) {
    const path = c.importFrom[framework] ?? `@iris-ui/${framework}`
    if (!byPath.has(path)) byPath.set(path, new Set())
    byPath.get(path)!.add(c.name)
    if (c.plugin) pluginNotes.push(`// Requires <IrisProvider plugins={[…]}> — install ${c.plugin}`)
  }

  const setup: string[] = []
  const extraImports: string[] = []
  const tagByName = new Map<string, string>()
  // Local state names already emitted — composing two `value`-controlled
  // components (e.g. Select + Calendar) must not declare `value` twice.
  const usedLocals = new Set<string>()

  for (const name of components) {
    const component = manifest.components.find((c) => c.name === name)!
    const kind = dataWiringKind(component)
    // A data stub (table/form/tree/select/calendar) supplies the data prop(s) it
    // owns; a controlled pair the stub does NOT own still gets real state. The
    // two are merged into one wired tag so e.g. a Select shows both its `items`
    // stub AND `value`/`onValueChange` state.
    const stub = kind ? dataStub(kind, framework) : null
    const owned: ReadonlySet<string> = stub ? new Set(stub.owns) : EMPTY_OWNED
    if (stub) {
      setup.push(...stub.setup)
      extraImports.push(...stub.extraImports)
    }
    // A controlled pair gets real state only when the stub doesn't own its value
    // prop; uniquify the local name just for the pairs we actually emit.
    const detected = detectControlledPair(component)
    const emitState = !!detected && !owned.has(detected.value)
    const pair = emitState ? uniqueLocal(detected, usedLocals) : detected
    if (emitState) setup.push(stateDecl(pair!, framework, stub?.seedOverride))
    tagByName.set(name, wiredTag(component, framework, pair, stub?.bind ?? '', owned))
  }

  // Assemble imports: framework state import (if any state was generated) +
  // data-stub imports + component imports.
  const importLines: string[] = []
  const needsState = setup.length > 0
  const fwImport = stateImport(framework)
  if (needsState && fwImport) importLines.push(fwImport)
  for (const imp of [...new Set(extraImports)]) importLines.push(imp)
  for (const [path, set] of byPath) {
    importLines.push(`import { ${Array.from(set).sort().join(', ')} } from '${path}'`)
  }
  const notes = [...new Set(pluginNotes)]
  const header = notes.length
    ? importLines.join('\n') + '\n' + notes.join('\n')
    : importLines.join('\n')

  const childTags = components.map((n) => '  ' + tagByName.get(n)!).join('\n')
  const classAttr = framework === 'vue' ? 'class' : 'className'
  const markup = layout
    ? `<${layout}>\n${childTags}\n</${layout}>`
    : `<div ${classAttr}="iris-view">\n${childTags}\n</div>`

  const setupBlock = setup.length ? setup.join('\n') + '\n\n' : ''
  return `${header}\n\n${setupBlock}${markup}`
}

/* -------------------------------------------------------------------------- */
/* Test skeleton                                                              */
/* -------------------------------------------------------------------------- */

/** The framework's testing-library import specifier. */
const TESTING_LIBRARY: Record<Framework, string> = {
  react: '@testing-library/react',
  vue: '@vue/test-utils',
  solid: '@solidjs/testing-library',
  svelte: '@testing-library/svelte',
}

/**
 * Whether the detected event/handler is click-like — i.e. firing a click on the
 * rendered root is a faithful way to drive it (e.g. `onClick`, `onPress`,
 * `onSelect`, `onToggle`). For these we emit a real interaction + a
 * `toHaveBeenCalled()` assertion; everything else keeps the no-spurious-emit
 * `not.toHaveBeenCalled()` mount-smoke.
 */
function isClickLike(event: string | undefined): boolean {
  return !!event && /click|press|select|toggle/i.test(event)
}

/**
 * Emit a minimal render + interaction test skeleton for `component` in
 * `framework`, derived from the manifest: it imports the component + the
 * framework's testing-library, renders it (controlled prop seeded + required
 * props filled), and asserts on one event handler (a spy) when the component
 * declares one. Deterministic; returns null for an unknown / unsupported
 * component.
 */
export function generateTest(
  manifest: IrisManifest,
  name: string,
  framework: Framework,
): string | null {
  const component = manifest.components.find((c) => c.name === name) ?? null
  if (!component || !component.frameworks.includes(framework)) return null

  const importPath = component.importFrom[framework] ?? `@iris-ui/${framework}`
  const pair = detectControlledPair(component)
  const event = component.events?.[0] ?? pair?.handler

  const required = otherRequiredProps(component, pair)
  const clickLike = isClickLike(event)
  const lines: string[] = []
  lines.push("import { describe, it, expect, vi } from 'vitest'")

  if (framework === 'react') {
    // RTL re-exports `fireEvent`; pull it in only when we drive a click.
    lines.push(`import { render${clickLike ? ', fireEvent' : ''} } from '${TESTING_LIBRARY.react}'`)
    lines.push(`import { ${name} } from '${importPath}'`)
    lines.push('')
    lines.push(`describe('${name}', () => {`)
    lines.push(`  it('renders and wires its event', () => {`)
    if (event) lines.push(`    const ${event} = vi.fn()`)
    const props = renderProps(component, pair, event, required, 'jsx')
    lines.push(`    const { container } = render(<${name}${props} />)`)
    lines.push(`    expect(container.firstChild).toBeTruthy()`)
    if (event && clickLike) {
      lines.push(`    fireEvent.click(container.firstChild as Element)`)
      lines.push(`    expect(${event}).toHaveBeenCalled()`)
    } else if (event) lines.push(`    expect(${event}).not.toHaveBeenCalled()`)
    lines.push(`  })`)
    lines.push(`})`)
  } else if (framework === 'solid') {
    lines.push(`import { render${clickLike ? ', fireEvent' : ''} } from '${TESTING_LIBRARY.solid}'`)
    lines.push(`import { ${name} } from '${importPath}'`)
    lines.push('')
    lines.push(`describe('${name}', () => {`)
    lines.push(`  it('renders and wires its event', () => {`)
    if (event) lines.push(`    const ${event} = vi.fn()`)
    const props = renderProps(component, pair, event, required, 'jsx')
    lines.push(`    const { container } = render(() => <${name}${props} />)`)
    lines.push(`    expect(container.firstChild).toBeTruthy()`)
    if (event && clickLike) {
      lines.push(`    fireEvent.click(container.firstChild as Element)`)
      lines.push(`    expect(${event}).toHaveBeenCalled()`)
    } else if (event) lines.push(`    expect(${event}).not.toHaveBeenCalled()`)
    lines.push(`  })`)
    lines.push(`})`)
  } else if (framework === 'svelte') {
    lines.push(
      `import { render${clickLike ? ', fireEvent' : ''} } from '${TESTING_LIBRARY.svelte}'`,
    )
    lines.push(`import { ${name} } from '${importPath}'`)
    lines.push('')
    lines.push(`describe('${name}', () => {`)
    lines.push(`  it('renders and wires its event', () => {`)
    if (event) lines.push(`    const ${event} = vi.fn()`)
    const props = renderProps(component, pair, event, required, 'object')
    lines.push(`    const { container } = render(${name}, { props: ${props} })`)
    lines.push(`    expect(container.firstChild).toBeTruthy()`)
    if (event && clickLike) {
      lines.push(`    fireEvent.click(container.firstChild as Element)`)
      lines.push(`    expect(${event}).toHaveBeenCalled()`)
    } else if (event) lines.push(`    expect(${event}).not.toHaveBeenCalled()`)
    lines.push(`  })`)
    lines.push(`})`)
  } else {
    // vue
    lines.push(`import { mount } from '${TESTING_LIBRARY.vue}'`)
    lines.push(`import { ${name} } from '${importPath}'`)
    lines.push('')
    lines.push(`describe('${name}', () => {`)
    lines.push(`  it('renders and wires its event', ${clickLike ? 'async ' : ''}() => {`)
    if (event) lines.push(`    const ${event} = vi.fn()`)
    const props = renderProps(component, pair, event, required, 'object')
    lines.push(`    const wrapper = mount(${name}, { props: ${props} })`)
    lines.push(`    expect(wrapper.exists()).toBe(true)`)
    if (event && clickLike) {
      lines.push(`    await wrapper.trigger('click')`)
      lines.push(`    expect(${event}).toHaveBeenCalled()`)
    } else if (event) lines.push(`    expect(${event}).not.toHaveBeenCalled()`)
    lines.push(`  })`)
    lines.push(`})`)
  }
  return lines.join('\n')
}

/** Render the prop list for a test invocation, as JSX attrs or an object literal. */
function renderProps(
  _component: ManifestComponent,
  pair: ControlledPair | null,
  event: string | undefined,
  required: ManifestProp[],
  style: 'jsx' | 'object',
): string {
  const entries: Array<[string, string]> = []
  if (pair) entries.push([pair.value, pair.default])
  if (event) entries.push([event, event])
  for (const p of required) {
    const { literal } = fillValue(p)
    entries.push([p.name, literal.startsWith('/*') ? `undefined /* ${p.type} */` : literal])
  }
  if (entries.length === 0) return style === 'object' ? '{}' : ''
  if (style === 'jsx') return ' ' + entries.map(([k, v]) => `${k}={${v}}`).join(' ')
  const body = entries.map(([k, v]) => `${k}: ${v}`).join(', ')
  return `{ ${body} }`
}
