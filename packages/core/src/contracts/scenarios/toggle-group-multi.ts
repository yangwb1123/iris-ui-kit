import type { ContractScenario } from '../types'

const ITEM = '[data-iris-toggle-group-item]'

/**
 * Shared MULTIPLE-mode ToggleGroup behavior — the multi-selection counterpart to
 * `toggleGroupScenario` (which covers single mode). Each adapter mounts a
 * `type="multiple"` group of three items (values `a`/`b`/`c`) with NONE pressed
 * initially (React/Solid `defaultValue={[]}`; Vue/Svelte a model harness holding
 * `[]`), then runs this. In multiple mode items expose `aria-pressed` (toggle
 * semantics, not radio); each toggles INDEPENDENTLY — pressing a second item does
 * not un-press the first (the key difference from single mode), and re-pressing an
 * active item toggles it back off. Exercises the shared selection model's
 * `mode: 'multiple'` path through every adapter.
 */
export const toggleGroupMultiScenario: ContractScenario = {
  name: 'ToggleGroupMultiple',
  description:
    'Multiple-mode: items toggle aria-pressed independently (second press keeps the first; re-press toggles off).',
  steps: [
    {
      label: 'initial: none pressed',
      action: 'none',
      expect: [
        { selector: ITEM, read: 'count', equals: 3 },
        { selector: ITEM, index: 0, read: 'aria-pressed', equals: 'false' },
        { selector: ITEM, index: 1, read: 'aria-pressed', equals: 'false' },
        { selector: ITEM, index: 2, read: 'aria-pressed', equals: 'false' },
      ],
    },
    {
      label: 'press first → only first pressed',
      action: 'click',
      target: ITEM,
      index: 0,
      expect: [
        { selector: ITEM, index: 0, read: 'aria-pressed', equals: 'true' },
        { selector: ITEM, index: 1, read: 'aria-pressed', equals: 'false' },
      ],
    },
    {
      label: 'press third → BOTH first and third pressed (independent)',
      action: 'click',
      target: ITEM,
      index: 2,
      expect: [
        { selector: ITEM, index: 2, read: 'aria-pressed', equals: 'true' },
        { selector: ITEM, index: 0, read: 'aria-pressed', equals: 'true' },
        { selector: ITEM, index: 1, read: 'aria-pressed', equals: 'false' },
      ],
    },
    {
      label: 're-press first → first toggles off, third stays pressed',
      action: 'click',
      target: ITEM,
      index: 0,
      expect: [
        { selector: ITEM, index: 0, read: 'aria-pressed', equals: 'false' },
        { selector: ITEM, index: 2, read: 'aria-pressed', equals: 'true' },
      ],
    },
  ],
}
