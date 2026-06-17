import type { Framework, ManifestComponent, ManifestProp } from '@iris-ui/manifest'

export interface ControlledPair {
  value: string
  handler: string
  type: string
  default: string
  local: string
}

const VALUE_PROP_PRIORITY = ['value', 'checked', 'open', 'selected', 'pressed']

function handlerFor(valueProp: string, names: Set<string>): string | undefined {
  const specific = `on${valueProp[0]!.toUpperCase()}${valueProp.slice(1)}Change`
  if (names.has(specific)) return specific
  if (names.has('onChange')) return 'onChange'
  return undefined
}

function seedFor(prop: ManifestProp): string {
  if (prop.default !== undefined) return prop.default
  if (prop.enum && prop.enum.length > 0) return `'${prop.enum[0]}'`
  const t = prop.type.toLowerCase()
  if (t === 'boolean' || /\bboolean\b/.test(t)) return 'false'
  if (t === 'number' || /\bnumber\b/.test(t)) return '0'
  if (t === 'string' || /\bstring\b/.test(t)) return "''"
  return 'undefined'
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
    const local = valueName === 'value' ? 'value' : valueName
    return { value: valueName, handler, type: prop.type, default: seedFor(prop), local }
  }
  return null
}

export function otherRequiredProps(
  component: ManifestComponent,
  pair: ControlledPair | null,
): ManifestProp[] {
  return (component.props ?? []).filter(
    (p) => !p.optional && p.name !== pair?.value && p.name !== pair?.handler,
  )
}

export function fillValue(prop: ManifestProp): { literal: string; isPlaceholder: boolean } {
  if (prop.default !== undefined) return { literal: prop.default, isPlaceholder: false }
  if (prop.enum && prop.enum.length > 0)
    return { literal: `'${prop.enum[0]}'`, isPlaceholder: false }
  return { literal: `/* ${prop.type} */`, isPlaceholder: true }
}

export function stateDecl(pair: ControlledPair, framework: Framework): string {
  const { local, default: seed } = pair
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

export function stateImport(framework: Framework): string | null {
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

export function controlledBinding(pair: ControlledPair, framework: Framework): string {
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

export function fillAttr(prop: ManifestProp, framework: Framework): string {
  const { literal, isPlaceholder } = fillValue(prop)
  if (framework === 'vue') {
    if (!isPlaceholder && /^'.*'$/.test(literal))
      return `${prop.name}=${literal.replace(/'/g, '"')}`
    return `:${prop.name}="${isPlaceholder ? `/* ${prop.type} */` : literal}"`
  }
  return `${prop.name}={${literal}}`
}

export function wiredTag(
  component: ManifestComponent,
  framework: Framework,
  pair: ControlledPair | null,
): string {
  const { name } = component
  const attrs: string[] = []
  if (pair) attrs.push(controlledBinding(pair, framework))
  for (const p of otherRequiredProps(component, pair)) attrs.push(fillAttr(p, framework))
  const attrStr = attrs.length ? ' ' + attrs.join(' ') : ''
  if (framework === 'vue') return `<${name}${attrStr} />`
  return `<${name}${attrStr}></${name}>`
}

export function dataWiringKind(component: ManifestComponent): 'table' | 'form' | null {
  if (['IrisProTable', 'IrisTable'].includes(component.name)) return 'table'
  if (component.name === 'IrisFormBuilder') return 'form'
  return null
}

export function tableStub(framework: Framework): {
  setup: string[]
  bind: string
  extraImports: string[]
} {
  const rows = `const rows = [\n  { id: 1, name: 'Ada', age: 36 },\n  { id: 2, name: 'Linus', age: 54 },\n]`
  const columns = `const columns = [\n  { key: 'name', title: 'Name', sortable: true },\n  { key: 'age', title: 'Age', sortable: true },\n]`
  const store = `const store = createProTableStore({ data: rows, columns, rowKey: 'id' })`
  const bind = framework === 'vue' ? ':store="store"' : 'store={store}'
  return {
    setup: [rows, columns, store],
    bind,
    extraImports: [`import { createProTableStore } from '@iris-ui/plugin-pro-table/core'`],
  }
}

export function formStub(framework: Framework): {
  setup: string[]
  bind: string
  extraImports: string[]
} {
  const schema = `const schema = {\n  fields: [\n    { name: 'email', type: 'text', required: true },\n    { name: 'role', type: 'select', options: [{ label: 'Admin', value: 'a' }] },\n  ],\n  submitLabel: 'Save',\n}`
  const bind = framework === 'vue' ? ':schema="schema"' : 'schema={schema}'
  return { setup: [schema], bind, extraImports: [] }
}

export function renderProps(
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
