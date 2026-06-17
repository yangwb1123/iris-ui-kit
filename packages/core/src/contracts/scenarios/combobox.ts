import type { ContractScenario } from '../types'

const INPUT = '[data-iris-combobox-input]'
const LISTBOX = '[role="listbox"]'
const OPTIONS = '[data-iris-combobox-option]'

/**
 * Shared Combobox (filterable single-select) behavior. Each adapter mounts
 * an uncontrolled IrisCombobox with options [Apple, Banana, Apricot, Grape].
 * The combobox opens on focus (click input), filters options as the user
 * types, and closes on selection (click an option) or Escape.
 *
 * Scenario: closed → click input → listbox opens → type "Ap" → options
 * filtered (Apple, Apricot) → click first option → listbox closes, value
 * reflects the selection.
 */
export const comboboxScenario: ContractScenario = {
  name: 'Combobox',
  description:
    'An uncontrolled combobox starts closed; clicking the input focuses it ' +
    'and opens the listbox; typing filters options; clicking an option ' +
    'selects it and closes the listbox.',
  steps: [
    {
      label: 'initial: closed',
      action: 'none',
      expect: [
        { selector: INPUT, read: 'count', equals: 1 },
        { selector: LISTBOX, read: 'count', equals: 0 },
      ],
    },
    {
      label: 'click input → focus → open',
      action: 'click',
      target: INPUT,
      expect: [
        { selector: LISTBOX, read: 'count', equals: 1 },
        { selector: OPTIONS, read: 'count', equals: 4 },
      ],
    },
    {
      label: 'type "Ap" → filter to Apple, Apricot',
      action: 'type',
      target: INPUT,
      typeText: 'Ap',
      expect: [
        { selector: OPTIONS, read: 'count', equals: 2 },
        { selector: OPTIONS, index: 0, read: 'text', equals: 'Apple' },
        { selector: OPTIONS, index: 1, read: 'text', equals: 'Apricot' },
      ],
    },
    {
      label: 'click first option → value selected, listbox closes',
      action: 'click',
      target: OPTIONS,
      index: 0,
      expect: [{ selector: LISTBOX, read: 'count', equals: 0 }],
    },
  ],
}
