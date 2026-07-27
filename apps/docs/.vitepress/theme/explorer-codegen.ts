// Manifest-driven, deterministic per-framework codegen for the docs Component
// Explorer. This is a small, browser-safe re-implementation of the wiring rules
// in `@iris-ui-kit/mcp`'s codegen (packages/mcp/src/codegen.ts): same controlled-pair
// detection, same per-framework state scaffolding (useState / ref / createSignal
// / $state), same v-model / bind: / value+handler attribute syntax.
//
// We re-implement (rather than import) because @iris-ui-kit/mcp is a Node MCP server
// (not a docs dep) and we only need the single-component snippet path here, fed by
// LIVE control values rather than the manifest defaults. The rules below mirror
// the mcp module so the docs code tabs match what the MCP `scaffold_component`
// tool would emit. Keep in sync if the mcp wiring rules change.

export type Framework = 'react' | 'vue' | 'solid' | 'svelte'

export interface ManifestProp {
  name: string
  type: string
  optional?: boolean
  enum?: string[]
  default?: string
  description?: string
}

export interface ManifestComponent {
  name: string
  frameworks: Framework[]
  importFrom?: Partial<Record<Framework, string>>
  plugin?: string
  props?: ManifestProp[]
  events?: string[]
  slots?: string[]
}

/* -------------------------------------------------------------------------- */
/* Controlled-pair detection (mirrors mcp codegen)                            */
/* -------------------------------------------------------------------------- */

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

function handlerFor(valueProp: string, names: Set<string>): string | undefined {
  const specific = `on${valueProp[0]!.toUpperCase()}${valueProp.slice(1)}Change`
  if (names.has(specific)) return specific
  if (names.has('onChange')) return 'onChange'
  return undefined
}

export interface ControlledPair {
  value: string
  handler: string
  type: string
  local: string
}

export function detectControlledPair(component: ManifestComponent): ControlledPair | null {
  const props = component.props ?? []
  const propNames = new Set(props.map((p) => p.name))
  const names = new Set<string>([...propNames, ...(component.events ?? [])])
  for (const valueName of VALUE_PROP_PRIORITY) {
    if (!propNames.has(valueName)) continue
    const handler = handlerFor(valueName, names)
    if (!handler) continue
    const prop = props.find((p) => p.name === valueName)!
    return {
      value: valueName,
      handler,
      type: prop.type,
      local: valueName === 'value' ? 'value' : valueName,
    }
  }
  return null
}

/* -------------------------------------------------------------------------- */
/* Type predicates                                                            */
/* -------------------------------------------------------------------------- */

function isBool(type: string): boolean {
  return /\bboolean\b/.test(type.toLowerCase())
}
function isNum(type: string): boolean {
  return /\bnumber\b/.test(type.toLowerCase())
}

/* -------------------------------------------------------------------------- */
/* Per-framework state scaffolding (mirrors mcp codegen)                      */
/* -------------------------------------------------------------------------- */

function seedLiteral(pair: ControlledPair, value: unknown): string {
  if (/\bboolean\b/.test(pair.type.toLowerCase())) return value ? 'true' : 'false'
  if (/\bnumber\b/.test(pair.type.toLowerCase()))
    return value === null || value === '' ? '0' : String(Number(value))
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`
  return value === undefined ? 'undefined' : String(value)
}

function stateImport(framework: Framework): string | null {
  switch (framework) {
    case 'react':
      return "import * as React from 'react'"
    case 'solid':
      return "import { createSignal } from 'solid-js'"
    case 'vue':
      return "import { ref } from 'vue'"
    case 'svelte':
      return null
  }
}

function stateDecl(pair: ControlledPair, framework: Framework, seed: string): string {
  const { local } = pair
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
      return value === 'value' ? `v-model="${local}"` : `v-model:${value}="${local}"`
  }
}

/* -------------------------------------------------------------------------- */
/* A static attribute (a live control value, not state-bound)                 */
/* -------------------------------------------------------------------------- */

function attrFor(prop: ManifestProp, value: unknown, framework: Framework): string | null {
  // Skip props left at their manifest default (keeps the snippet minimal).
  if (prop.default !== undefined) {
    const norm = isBool(prop.type)
      ? value
        ? 'true'
        : 'false'
      : isNum(prop.type)
        ? String(value)
        : String(value)
    if (norm === prop.default) return null
  }
  // Skip empty string / null number controls.
  if ((isNum(prop.type) && (value === '' || value === null)) || value === undefined) return null

  if (framework === 'vue') {
    if (isBool(prop.type)) return value ? prop.name : `:${prop.name}="false"`
    if (isNum(prop.type)) return `:${prop.name}="${Number(value)}"`
    if (prop.enum && prop.enum.length) return `${prop.name}="${String(value)}"`
    // string
    return value === '' ? null : `${prop.name}="${String(value)}"`
  }
  // react / solid / svelte share JSX-ish attr syntax for non-controlled props.
  if (isBool(prop.type)) return value ? prop.name : `${prop.name}={false}`
  if (isNum(prop.type)) return `${prop.name}={${Number(value)}}`
  if (prop.enum && prop.enum.length) return `${prop.name}="${String(value)}"`
  return value === '' ? null : `${prop.name}="${String(value)}"`
}

/* -------------------------------------------------------------------------- */
/* Event-handler stubs + named-slot placeholders (per-framework)              */
/* -------------------------------------------------------------------------- */

// Vue uses kebab-case `@event` directives; map a React-style `onClick` handler
// name to its Vue event name (`onClick` -> `@click`).
function vueEventName(handler: string): string {
  const base = handler.replace(/^on/, '')
  return (
    base.charAt(0).toLowerCase() + base.slice(1).replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
  )
}

/** A single event-handler attribute (deterministic no-op stub) for `framework`. */
function eventAttr(handler: string, framework: Framework): string {
  switch (framework) {
    case 'vue':
      return `@${vueEventName(handler)}="() => {}"`
    // react / solid / svelte share the JSX-ish `onEvent={...}` syntax.
    default:
      return `${handler}={() => {}}`
  }
}

/**
 * Render named-slot placeholders (everything except `default`, which is handled
 * by `childText`). Returns the per-framework slot scaffolding to inject INSIDE
 * the element (Vue/Svelte) or the extra attrs (React/Solid render-prop style).
 */
function slotScaffold(slots: string[], framework: Framework): { attrs: string[]; inner: string[] } {
  const named = slots.filter((s) => s !== 'default')
  const attrs: string[] = []
  const inner: string[] = []
  for (const slot of named) {
    switch (framework) {
      case 'vue':
        inner.push(`<template #${slot}><!-- ${slot} --></template>`)
        break
      case 'svelte':
        inner.push(`{#snippet ${slot}()}<!-- ${slot} -->{/snippet}`)
        break
      // react / solid pass named slots as render-prop / node props.
      default:
        attrs.push(`${slot}={/* ${slot} */ null}`)
        break
    }
  }
  return { attrs, inner }
}

/* -------------------------------------------------------------------------- */
/* Public: single-component snippet from LIVE control values                  */
/* -------------------------------------------------------------------------- */

export interface SnippetOptions {
  /** The current control values, keyed by manifest prop name. */
  values: Record<string, unknown>
  /** Optional child text (the component's default slot / children). */
  childText?: string
  /** Which props the explorer exposed as controls (others are omitted). */
  controlledPropNames: string[]
}

/**
 * Emit a self-contained, copy-pasteable snippet for `component` in `framework`,
 * using the live `values`. Controlled value/handler pairs become real state
 * scaffolding (per the mcp wiring rules); all other controlled props are emitted
 * as static attributes (skipping ones left at their manifest default).
 */
export function snippetFor(
  component: ManifestComponent,
  framework: Framework,
  opts: SnippetOptions,
): string {
  const { name } = component
  const importPath = component.importFrom?.[framework] ?? `@iris-ui-kit/${framework}`
  const propByName = new Map((component.props ?? []).map((p) => [p.name, p]))
  const pair = detectControlledPair(component)

  const attrs: string[] = []
  const setupLines: string[] = []

  // The controlled value (e.g. `checked`) is scaffolded as state when present
  // in the exposed controls; its handler is the change handler.
  if (pair && opts.controlledPropNames.includes(pair.value)) {
    const seed = seedLiteral(pair, opts.values[pair.value])
    setupLines.push(stateDecl(pair, framework, seed))
    attrs.push(controlledBinding(pair, framework))
  }

  for (const propName of opts.controlledPropNames) {
    if (pair && (propName === pair.value || propName === pair.handler)) continue
    const prop = propByName.get(propName)
    if (!prop) continue
    const attr = attrFor(prop, opts.values[propName], framework)
    if (attr) attrs.push(attr)
  }

  // Declared events become deterministic no-op handler stubs. Skip the handler
  // already wired by the controlled value/handler pair (it lives in the v-model /
  // value+setter binding above), so we don't emit it twice.
  for (const event of component.events ?? []) {
    if (pair && event === pair.handler) continue
    attrs.push(eventAttr(event, framework))
  }

  // Named-slot placeholders. The `default` slot is represented by `childText`
  // below; a component that declares a `default` slot but has no live child text
  // still gets a visible placeholder so the slot is discoverable.
  const slots = component.slots ?? []
  const { attrs: slotAttrs, inner: slotInner } = slotScaffold(slots, framework)
  attrs.push(...slotAttrs)

  const attrStr = attrs.length ? ' ' + attrs.join(' ') : ''
  let child = opts.childText?.trim() ? opts.childText.trim() : ''
  if (!child && slots.includes('default')) {
    // Use a framework-valid placeholder for the default slot: an HTML comment in
    // Vue/Svelte templates, a JSX comment expression in React/Solid.
    child = framework === 'vue' || framework === 'svelte' ? '<!-- default -->' : '{/* default */}'
  }

  // Markup — named slots (Vue templates / Svelte snippets) live inside the
  // element; React/Solid named slots are already in `attrs` as node props.
  const innerSlots = slotInner.join('')
  const inner = `${child}${innerSlots}`
  const markup = inner ? `<${name}${attrStr}>${inner}</${name}>` : `<${name}${attrStr} />`

  // Assemble per-framework file shape.
  const needsState = setupLines.length > 0
  const fwStateImport = needsState ? stateImport(framework) : null
  const compImport = `import { ${name} } from '${importPath}'`

  switch (framework) {
    case 'react': {
      const imports = [fwStateImport, compImport].filter(Boolean).join('\n')
      const body = needsState ? `  ${setupLines.join('\n  ')}\n  ` : '  '
      return `${imports}\n\nexport function Example() {\n${body}return (\n    ${markup}\n  )\n}`
    }
    case 'solid': {
      const imports = [fwStateImport, compImport].filter(Boolean).join('\n')
      const body = needsState ? `  ${setupLines.join('\n  ')}\n  ` : '  '
      return `${imports}\n\nexport function Example() {\n${body}return (\n    ${markup}\n  )\n}`
    }
    case 'svelte': {
      const scriptInner = [compImport, ...setupLines].join('\n  ')
      return `<script lang="ts">\n  ${scriptInner}\n</script>\n\n${markup}`
    }
    case 'vue': {
      const scriptInner = [fwStateImport, compImport, ...setupLines].filter(Boolean).join('\n')
      return `<script setup lang="ts">\n${scriptInner}\n</script>\n\n<template>\n  ${markup}\n</template>`
    }
  }
}
