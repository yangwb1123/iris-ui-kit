import type { ContractScenario } from '../types'

const TRIGGER = '[data-iris-accordion-trigger]'

/**
 * Shared Accordion behavior. Each adapter mounts an accordion with two items,
 * both initially collapsed, and runs this. Clicking a trigger expands it
 * (`aria-expanded`). Asserting only the CLICKED trigger keeps the contract
 * mode-agnostic (single- vs multiple-open differ on the sibling's state).
 */
export const accordionScenario: ContractScenario = {
  name: 'Accordion',
  description: 'Clicking a trigger expands it (aria-expanded tracks the clicked item).',
  steps: [
    {
      label: 'initial: both collapsed',
      action: 'none',
      expect: [
        { selector: TRIGGER, read: 'count', equals: 2 },
        { selector: TRIGGER, index: 0, read: 'aria-expanded', equals: 'false' },
        { selector: TRIGGER, index: 1, read: 'aria-expanded', equals: 'false' },
      ],
    },
    {
      label: 'click first → expands',
      action: 'click',
      target: TRIGGER,
      index: 0,
      expect: [{ selector: TRIGGER, index: 0, read: 'aria-expanded', equals: 'true' }],
    },
    {
      label: 'click second → expands',
      action: 'click',
      target: TRIGGER,
      index: 1,
      expect: [{ selector: TRIGGER, index: 1, read: 'aria-expanded', equals: 'true' }],
    },
  ],
}
