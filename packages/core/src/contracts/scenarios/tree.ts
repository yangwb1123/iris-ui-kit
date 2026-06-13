import type { ContractScenario } from '../types'

const ITEM = '[role="treeitem"]'
/**
 * The single roving-focus target. All four adapters keep exactly one treeitem at
 * `tabindex="0"` (the rest `-1`), so this selector resolves to the active node —
 * the right keydown target regardless of whether the adapter attaches its handler
 * at the container (React/Solid, where the event bubbles up) or per-item
 * (Vue/Svelte, where it fires directly).
 */
const ACTIVE = '[role="treeitem"][tabindex="0"]'

/**
 * Shared Tree keyboard behavior. Each adapter mounts a tree of two roots — `a`
 * (with children `a1`/`a2`) and leaf `b` — initially collapsed, with the first
 * node roving-active. This drives the WAI-ARIA tree keyboard pattern through the
 * shared expansion controller: ArrowRight expands the active parent (revealing
 * its children in the flat visible order), ArrowDown moves the roving focus to
 * the next visible node, and ArrowLeft from a leaf child returns focus to its
 * parent. Asserts identical expansion + roving-focus migration across all four
 * adapters (only `aria-expanded` + the roving `tabindex` are read, so the
 * contract is independent of selection mode).
 */
export const treeScenario: ContractScenario = {
  name: 'Tree',
  description:
    'Keyboard: ArrowRight expands the active node, ArrowDown moves roving focus, ArrowLeft returns to parent.',
  steps: [
    {
      label: 'initial: collapsed, first node active',
      action: 'none',
      expect: [
        { selector: ITEM, read: 'count', equals: 2 },
        { selector: ACTIVE, read: 'count', equals: 1 },
        { selector: ITEM, index: 0, read: 'aria-expanded', equals: 'false' },
      ],
    },
    {
      label: 'ArrowRight → active node expands (children become visible)',
      action: 'keydown',
      target: ACTIVE,
      key: 'ArrowRight',
      expect: [
        { selector: ITEM, index: 0, read: 'aria-expanded', equals: 'true' },
        { selector: ITEM, read: 'count', equals: 4 },
      ],
    },
    {
      label: 'ArrowDown → roving focus moves to the first child',
      action: 'keydown',
      target: ACTIVE,
      key: 'ArrowDown',
      expect: [
        { selector: ITEM, index: 0, read: 'tabindex', equals: '-1' },
        { selector: ITEM, index: 1, read: 'tabindex', equals: '0' },
      ],
    },
    {
      label: 'ArrowLeft from a leaf child → focus returns to the parent',
      action: 'keydown',
      target: ACTIVE,
      key: 'ArrowLeft',
      expect: [
        { selector: ITEM, index: 0, read: 'tabindex', equals: '0' },
        { selector: ITEM, index: 1, read: 'tabindex', equals: '-1' },
      ],
    },
  ],
}
