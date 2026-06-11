import type { ContractScenario } from '../types'

const TRIGGER = '[data-iris-tabs-trigger]'

/**
 * Shared Tabs behavior. Each adapter mounts IrisTabs with three triggers
 * (labelled Tab A/B/C, panels Panel A/B/C, first active) and runs this. Clicking
 * a trigger activates it: `aria-selected` tracks exactly one active trigger and
 * the active `tabpanel` updates.
 */
export const tabsScenario: ContractScenario = {
  name: 'Tabs',
  description: 'Clicking a trigger activates it; aria-selected tracks the active tab.',
  steps: [
    {
      label: 'initial: first tab active',
      action: 'none',
      expect: [
        { selector: TRIGGER, read: 'count', equals: 3 },
        { selector: TRIGGER, index: 0, read: 'aria-selected', equals: 'true' },
        { selector: TRIGGER, index: 1, read: 'aria-selected', equals: 'false' },
        { selector: TRIGGER, index: 2, read: 'aria-selected', equals: 'false' },
      ],
    },
    {
      label: 'click second tab → it activates, first deactivates',
      action: 'click',
      target: TRIGGER,
      index: 1,
      expect: [
        { selector: TRIGGER, index: 0, read: 'aria-selected', equals: 'false' },
        { selector: TRIGGER, index: 1, read: 'aria-selected', equals: 'true' },
        { selector: TRIGGER, index: 2, read: 'aria-selected', equals: 'false' },
        // The active panel is exposed once and shows the active tab's content.
        { selector: '[role="tabpanel"]', read: 'count', equals: 1 },
        { selector: '[role="tabpanel"]', read: 'text', equals: 'Panel B' },
      ],
    },
    {
      label: 'click third tab → it activates',
      action: 'click',
      target: TRIGGER,
      index: 2,
      expect: [
        { selector: TRIGGER, index: 1, read: 'aria-selected', equals: 'false' },
        { selector: TRIGGER, index: 2, read: 'aria-selected', equals: 'true' },
        { selector: '[role="tabpanel"]', read: 'text', equals: 'Panel C' },
      ],
    },
  ],
}
