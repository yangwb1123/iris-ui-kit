/**
 * Cross-framework behavior contract scenarios.
 *
 * A scenario is framework-agnostic DATA: a sequence of DOM interactions (located
 * by role / `data-iris-*` selectors that all four adapters share) plus attribute
 * assertions checked after each step. Every adapter runs the SAME scenario
 * against its own component through a thin {@link ContractDriver}, so a bridge
 * bug that diverges from the shared behavior fails CI — not just name parity
 * (which the manifest already guards). The four core controllers are
 * framework-agnostic, so identical interactions must yield identical observable
 * state across React / Vue / Solid / Svelte.
 */

/** One observable assertion checked against the mounted DOM after a step. */
export interface ContractAssertion {
  /** CSS selector — role/`data-iris-*` based, identical across adapters. */
  selector: string
  /** Which match to read when several. Default 0. */
  index?: number
  /**
   * What to read: an attribute name (e.g. `'aria-selected'`), `'text'` for
   * trimmed `textContent`, or `'count'` for how many elements match `selector`.
   */
  read: string
  /** Expected value: string for an attr/text, number for `'count'`, null for absent. */
  equals: string | number | null
}

/** A single interaction plus the assertions that must hold afterwards. */
export interface ContractStep {
  label: string
  action: 'none' | 'click' | 'keydown' | 'pointer'
  /** Target selector for actions. */
  target?: string
  index?: number
  /** Key name for `keydown` (e.g. `'ArrowRight'`, `'Enter'`, `'Escape'`). */
  key?: string
  /** Pointer event type for `'pointer'` action (e.g. `'enter'`, `'leave'`). */
  pointerEvent?: string
  expect: ContractAssertion[]
}

export interface ContractScenario {
  name: string
  /** Human description of the shared behavior under test. */
  description: string
  steps: ContractStep[]
}

/**
 * The element shape the runner reads for assertions. A real DOM `Element`
 * satisfies it structurally, so the contract layer stays free of the DOM lib
 * (core is framework- and DOM-agnostic).
 */
export interface ContractElement {
  getAttribute(name: string): string | null
  readonly textContent: string | null
}

/**
 * Thin per-framework adapter the runner drives a scenario through. Actions are
 * by `(selector, index)` so the driver owns the real elements + event firing
 * (testing-library specifics); the runner only reads attributes for assertions.
 */
export interface ContractDriver {
  /** Elements under the mounted root matching `selector` (read for assertions). */
  queryAll(selector: string): ContractElement[]
  /** Activate the `index`-th match of `selector` (the lib's click/pointer sequence). */
  click(selector: string, index: number): void | Promise<void>
  /** Dispatch a keydown carrying `key` on the `index`-th match of `selector`. */
  keydown(selector: string, index: number, key: string): void | Promise<void>
  /** Dispatch a pointer event (`'enter'`, `'leave'`) on the `index`-th match. */
  pointer(selector: string, index: number, event: string): void | Promise<void>
  /** Settle pending reactivity so the following assertions see the final DOM. */
  flush(): void | Promise<void>
}

/** Minimal vitest-`expect` shape the runner needs (injected by each adapter). */
export type ContractExpect = (
  actual: unknown,
  message?: string,
) => { toBe(expected: unknown): void }
