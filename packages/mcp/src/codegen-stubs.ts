import type { Framework, ManifestComponent } from '@iris-ui-kit/manifest'

/**
 * Deterministic data-wiring stubs for the data-bearing component families.
 *
 * A "data stub" is the runnable-against-stub scaffolding that `generateView`
 * splices in for a component whose primary contract is a data collection (table
 * rows, a form schema, tree nodes, select items, a calendar value). Each stub is
 * a pure function of `framework` returning:
 *  - `setup`: local declarations to emit in the view's setup block (in order),
 *  - `bind`: the attribute string to place on the component's tag (already in
 *    the right per-framework syntax — `:prop="x"` for Vue, `prop={x}` else),
 *  - `extraImports`: any import lines the setup relies on (e.g. the table store
 *    factory). Empty for inline literals.
 *
 * Splitting this out of `codegen.ts` keeps that module under the 500-line
 * architecture ratchet; the wiring RULES (which component → which stub) live in
 * {@link dataWiringKind}, and `generateView` composes the pieces.
 */

/** The shape a data stub returns for a single component. */
export interface DataStub {
  /** Local declarations for the setup block, in emission order. */
  setup: string[]
  /** The attribute string to place on the component tag (per-framework syntax). */
  bind: string
  /** Import lines the setup relies on (deduped by the caller). */
  extraImports: string[]
  /**
   * Prop names the stub already binds on the tag. The caller skips these when
   * adding the component's controlled-pair / required-prop attributes, so we
   * never double-bind a prop (e.g. a Tree's `nodes`, a Select's `items`).
   */
  owns: string[]
  /**
   * An optional literal that overrides the controlled-pair seed (otherwise the
   * generic typed default). Lets a data family seed a richer value through the
   * normal per-framework state machinery — e.g. a Calendar's `value` seeded with
   * a concrete `new Date(...)` while keeping the idiomatic `v-model`/`bind:`/…
   * binding. Framework-neutral; emitted verbatim into `useState`/`ref`/`$state`.
   */
  seedOverride?: string
}

/**
 * The data-wiring families we know how to stub. Each maps a concrete
 * data-bearing component to a deterministic, compile-able stub:
 *  - `table` → in-memory rows/columns through the real ProTable store,
 *  - `form`  → a form-builder schema literal,
 *  - `tree`  → an `IrisTreeNode[]` literal bound to `nodes`,
 *  - `select`→ an `IrisSelectItem[]` literal bound to `items`,
 *  - `calendar` → seeds the controlled `value` with a concrete `Date`.
 */
export type DataWiringKind = 'table' | 'form' | 'tree' | 'select' | 'calendar'

/**
 * Whether `component` is a data component we know how to wire to a deterministic
 * stub, and which family it belongs to. These map to concrete library prop
 * contracts (consult the manifest: ProTable/Table → `store`, FormBuilder →
 * `schema`, Tree → `nodes`, Select → `items`, Calendar → `value`).
 */
export function dataWiringKind(component: ManifestComponent): DataWiringKind | null {
  switch (component.name) {
    case 'IrisProTable':
    case 'IrisTable':
      return 'table'
    case 'IrisFormBuilder':
      return 'form'
    case 'IrisTree':
      return 'tree'
    case 'IrisSelect':
      return 'select'
    case 'IrisCalendar':
      return 'calendar'
    default:
      return null
  }
}

/** Build the per-framework prop binding for a static expression value. */
function exprBind(prop: string, local: string, framework: Framework): string {
  return framework === 'vue' ? `:${prop}="${local}"` : `${prop}={${local}}`
}

/** A deterministic data stub + the prop binding for a table component (`store`). */
function tableStub(framework: Framework): DataStub {
  // A runnable-against-stub table: in-memory rows + columns fed through the real
  // engine. ProTable consumes a `store`; we build it with createProTableStore.
  const rows = `const rows = [\n  { id: 1, name: 'Ada', age: 36 },\n  { id: 2, name: 'Linus', age: 54 },\n]`
  const columns = `const columns = [\n  { key: 'name', title: 'Name', sortable: true },\n  { key: 'age', title: 'Age', sortable: true },\n]`
  const store = `const store = createProTableStore({ data: rows, columns, rowKey: 'id' })`
  return {
    setup: [rows, columns, store],
    bind: exprBind('store', 'store', framework),
    extraImports: [`import { createProTableStore } from '@iris-ui-kit/plugin-pro-table/core'`],
    owns: ['store'],
  }
}

/** A deterministic data stub + the prop binding for a form-builder component (`schema`). */
function formStub(framework: Framework): DataStub {
  const schema = `const schema = {\n  fields: [\n    { name: 'email', type: 'text', required: true },\n    { name: 'role', type: 'select', options: [{ label: 'Admin', value: 'a' }] },\n  ],\n  submitLabel: 'Save',\n}`
  return {
    setup: [schema],
    bind: exprBind('schema', 'schema', framework),
    extraImports: [],
    owns: ['schema'],
  }
}

/** A deterministic data stub + the prop binding for a Tree component (`nodes`). */
function treeStub(framework: Framework): DataStub {
  // IrisTreeNode[]: id + label, optional nested children.
  const nodes = `const nodes = [\n  {\n    id: 'root',\n    label: 'Root',\n    children: [\n      { id: 'child-1', label: 'Child 1' },\n      { id: 'child-2', label: 'Child 2' },\n    ],\n  },\n]`
  return {
    setup: [nodes],
    bind: exprBind('nodes', 'nodes', framework),
    extraImports: [],
    owns: ['nodes'],
  }
}

/** A deterministic data stub + the prop binding for a Select component (`items`). */
function selectStub(framework: Framework): DataStub {
  // IrisSelectItem[]: value + label.
  const items = `const items = [\n  { value: 'a', label: 'Option A' },\n  { value: 'b', label: 'Option B' },\n]`
  return {
    setup: [items],
    bind: exprBind('items', 'items', framework),
    extraImports: [],
    owns: ['items'],
  }
}

/**
 * A deterministic data stub for a Calendar component. Calendar's "data" is its
 * selected `value` (a `Date`), which IS a controlled pair (`value` +
 * `onValueChange`); rather than own the binding, we seed that pair with a
 * concrete date and let the normal per-framework state machinery emit the
 * idiomatic binding (`v-model` / `bind:value` / `value()` / `value={value}`).
 */
function calendarStub(): DataStub {
  return { setup: [], bind: '', extraImports: [], owns: [], seedOverride: `new Date('2026-01-01')` }
}

/** Resolve the {@link DataStub} for a known data-wiring `kind` in `framework`. */
export function dataStub(kind: DataWiringKind, framework: Framework): DataStub {
  switch (kind) {
    case 'table':
      return tableStub(framework)
    case 'form':
      return formStub(framework)
    case 'tree':
      return treeStub(framework)
    case 'select':
      return selectStub(framework)
    case 'calendar':
      return calendarStub()
  }
}
