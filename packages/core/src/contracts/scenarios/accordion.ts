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
 * (`loop: true`), and Home/End jump to the first/last header.
 *
 * The keyboard steps deliberately do NOT assert `focused` on the CLICK steps
 * first — `driver.click`'s `fireEvent.focus`+`fireEvent.click` reliably
 * trigger each adapter's onFocus handler (which is what actually updates the
 * keyboard-nav controller's tracked active index, independent of jsdom's
 * `document.activeElement`), but whether jsdom's real focus state matches
 * immediately after a synthetic click is a jsdom/testing-library timing
 * question, not a component-behavior one — it flaked under full-suite load.
 * The keydown steps instead call each adapter's OWN explicit `.focus()` DOM
 * call when moving the active item, which is a real, direct, synchronous
 * browser API call and reliably observable via `document.activeElement`.
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
