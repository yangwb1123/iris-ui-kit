import type { ContractScenario } from '../types'

const ITEM = '[data-iris-toggle-group-item]'

/**
 * Shared single-mode ToggleGroup behavior. Each adapter mounts a `type="single"`
 * group with three items (values `a`/`b`/`c`) and the first active by default
 * (React/Solid/Svelte `defaultValue="a"`; Vue via a v-model harness holding
 * `'a'`), then runs this. In single mode items expose `role="radio"` +
 * `aria-checked`; clicking a DISTINCT item moves the checked state to it and
 * unchecks the prior one. Re-clicking the active item is never exercised, so the
 * contract is agnostic to single-mode toggle-off behavior.
 */
export const toggleGroupScenario: ContractScenario = {
  name: 'ToggleGroup',
  description: 'Single-mode: clicking a distinct item moves aria-checked to it (radio semantics).',
  steps: [
    {
      label: 'initial: first active',
      action: 'none',
      expect: [
        { selector: ITEM, read: 'count', equals: 3 },
        { selector: ITEM, index: 0, read: 'aria-checked', equals: 'true' },
        { selector: ITEM, index: 1, read: 'aria-checked', equals: 'false' },
        { selector: ITEM, index: 2, read: 'aria-checked', equals: 'false' },
      ],
    },
    {
      label: 'click second → checked moves',
      action: 'click',
      target: ITEM,
      index: 1,
      expect: [
        { selector: ITEM, index: 1, read: 'aria-checked', equals: 'true' },
        { selector: ITEM, index: 0, read: 'aria-checked', equals: 'false' },
      ],
    },
    {
      label: 'click third → checked moves',
      action: 'click',
      target: ITEM,
      index: 2,
      expect: [
        { selector: ITEM, index: 2, read: 'aria-checked', equals: 'true' },
        { selector: ITEM, index: 1, read: 'aria-checked', equals: 'false' },
      ],
    },
  ],
}
