import type { ContractScenario } from '../types'

const TRIGGER = '[data-iris-accordion-trigger]'

/**
 * Shared Accordion behavior. Each adapter mounts an accordion with two items,
 * both initially collapsed, and runs this. Clicking a trigger expands it
 * (`aria-expanded`). Asserting only the CLICKED trigger keeps the contract
 * mode-agnostic (single- vs multiple-open differ on the sibling's state).
 *
 * Also covers the roving-focus keyboard pattern (WAI-ARIA accordion):
 * ArrowUp/Down move focus between headers, wrapping at the boundaries
 * (`loop: true`), and Home/End jump to the first/last header. `driver.click`
 * fires a synthetic focus event before the click, so "click first → expands"
 * leaves trigger 0 focused — the keyboard steps build on that instead of
 * needing a dedicated focus step.
 */
export const accordionScenario: ContractScenario = {
  name: 'Accordion',
  description:
    'Clicking a trigger expands it (aria-expanded tracks the clicked item). ' +
    'ArrowUp/Down move focus between headers (wrapping); Home/End jump to the ends.',
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
      label: 'click first → expands, focuses',
      action: 'click',
      target: TRIGGER,
      index: 0,
      expect: [
        { selector: TRIGGER, index: 0, read: 'aria-expanded', equals: 'true' },
        { selector: TRIGGER, index: 0, read: 'focused', equals: 'true' },
      ],
    },
    {
      label: 'click second → expands, focuses',
      action: 'click',
      target: TRIGGER,
      index: 1,
      expect: [
        { selector: TRIGGER, index: 1, read: 'aria-expanded', equals: 'true' },
        { selector: TRIGGER, index: 1, read: 'focused', equals: 'true' },
      ],
    },
    {
      label: 'ArrowUp → first header focused',
      action: 'keydown',
      target: TRIGGER,
      index: 1,
      key: 'ArrowUp',
      expect: [
        { selector: TRIGGER, index: 0, read: 'focused', equals: 'true' },
        { selector: TRIGGER, index: 1, read: 'focused', equals: 'false' },
      ],
    },
    {
      label: 'ArrowUp wraps → last header focused',
      action: 'keydown',
      target: TRIGGER,
      index: 0,
      key: 'ArrowUp',
      expect: [
        { selector: TRIGGER, index: 0, read: 'focused', equals: 'false' },
        { selector: TRIGGER, index: 1, read: 'focused', equals: 'true' },
      ],
    },
    {
      label: 'Home → first header focused',
      action: 'keydown',
      target: TRIGGER,
      index: 1,
      key: 'Home',
      expect: [
        { selector: TRIGGER, index: 0, read: 'focused', equals: 'true' },
        { selector: TRIGGER, index: 1, read: 'focused', equals: 'false' },
      ],
    },
    {
      label: 'End → last header focused',
      action: 'keydown',
      target: TRIGGER,
      index: 0,
      key: 'End',
      expect: [
        { selector: TRIGGER, index: 0, read: 'focused', equals: 'false' },
        { selector: TRIGGER, index: 1, read: 'focused', equals: 'true' },
      ],
    },
    {
      label: 'ArrowDown wraps → first header focused',
      action: 'keydown',
      target: TRIGGER,
      index: 1,
      key: 'ArrowDown',
      expect: [
        { selector: TRIGGER, index: 0, read: 'focused', equals: 'true' },
        { selector: TRIGGER, index: 1, read: 'focused', equals: 'false' },
      ],
    },
  ],
}
