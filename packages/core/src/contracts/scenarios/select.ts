import type { ContractScenario } from '../types'

const TRIGGER = '[data-iris-select-trigger]'
const LISTBOX = '[role="listbox"]'
const OPTIONS = '[role="option"]'

/**
 * Shared Select (single-select dropdown) behavior. Each adapter mounts
 * an uncontrolled IrisSelect with items [Apple, Banana, Apricot, Grape].
 * The select opens on trigger click, shows all options, and closes on
 * selection (click an option) or on a second click of the trigger.
 *
 * Scenario: closed → click trigger → listbox opens → click first option →
 * listbox closes, value reflects the selection.
 */
export const selectScenario: ContractScenario = {
  name: 'Select',
  description:
    'An uncontrolled single-select starts closed; clicking the trigger ' +
    'opens a listbox; clicking an option selects it and closes the listbox.',
  steps: [
    {
      label: 'initial: closed',
      action: 'none',
      expect: [
        { selector: TRIGGER, read: 'count', equals: 1 },
        { selector: LISTBOX, read: 'count', equals: 0 },
      ],
    },
    {
      label: 'click trigger → listbox opens',
      action: 'click',
      target: TRIGGER,
      expect: [
        { selector: LISTBOX, read: 'count', equals: 1 },
        { selector: OPTIONS, read: 'count', equals: 4 },
      ],
    },
    {
      label: 'click first option → selected, closes',
      action: 'click',
      target: OPTIONS,
      index: 0,
      expect: [{ selector: LISTBOX, read: 'count', equals: 0 }],
    },
  ],
}
