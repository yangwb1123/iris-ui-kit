import type { ContractScenario } from '../types'

const LIST = '[role="listbox"]'
const ITEM = '[role="option"]'

/**
 * Shared List keyboard behavior. Each adapter mounts an uncontrolled IrisList
 * with 3 options (Alpha, Bravo, Charlie, all enabled) and runs this.
 * ArrowDown/Up move focus (tracked by roving tabindex), Home/End jump to
 * first/last, Enter/Space select and fire onValueChange.
 */
export const listKeyboardScenario: ContractScenario = {
  name: 'ListKeyboard',
  description:
    'ArrowDown/Up move focus on options; Home/End jump; Enter/Space select. ' +
    'Focus tracked by roving tabindex (the active option has tabindex=0, ' +
    'others have -1).',
  steps: [
    {
      label: 'initial: first item focussed',
      action: 'none',
      expect: [
        { selector: LIST, read: 'count', equals: 1 },
        { selector: ITEM, read: 'count', equals: 3 },
        { selector: ITEM, index: 0, read: 'tabindex', equals: '0' },
        { selector: ITEM, index: 1, read: 'tabindex', equals: '-1' },
        { selector: ITEM, index: 2, read: 'tabindex', equals: '-1' },
      ],
    },
    {
      label: 'ArrowDown → second item focused',
      action: 'keydown',
      target: LIST,
      key: 'ArrowDown',
      expect: [
        { selector: ITEM, index: 0, read: 'tabindex', equals: '-1' },
        { selector: ITEM, index: 1, read: 'tabindex', equals: '0' },
        { selector: ITEM, index: 2, read: 'tabindex', equals: '-1' },
      ],
    },
    {
      label: 'ArrowDown → third item focused',
      action: 'keydown',
      target: LIST,
      key: 'ArrowDown',
      expect: [
        { selector: ITEM, index: 0, read: 'tabindex', equals: '-1' },
        { selector: ITEM, index: 1, read: 'tabindex', equals: '-1' },
        { selector: ITEM, index: 2, read: 'tabindex', equals: '0' },
      ],
    },
    {
      label: 'ArrowDown wraps → first item focused',
      action: 'keydown',
      target: LIST,
      key: 'ArrowDown',
      expect: [
        { selector: ITEM, index: 0, read: 'tabindex', equals: '0' },
        { selector: ITEM, index: 1, read: 'tabindex', equals: '-1' },
        { selector: ITEM, index: 2, read: 'tabindex', equals: '-1' },
      ],
    },
    {
      label: 'ArrowUp wraps → last item focused',
      action: 'keydown',
      target: LIST,
      key: 'ArrowUp',
      expect: [
        { selector: ITEM, index: 0, read: 'tabindex', equals: '-1' },
        { selector: ITEM, index: 1, read: 'tabindex', equals: '-1' },
        { selector: ITEM, index: 2, read: 'tabindex', equals: '0' },
      ],
    },
    {
      label: 'End → last item focused',
      action: 'keydown',
      target: LIST,
      key: 'End',
      expect: [
        { selector: ITEM, index: 0, read: 'tabindex', equals: '-1' },
        { selector: ITEM, index: 1, read: 'tabindex', equals: '-1' },
        { selector: ITEM, index: 2, read: 'tabindex', equals: '0' },
      ],
    },
    {
      label: 'Home → first item focused',
      action: 'keydown',
      target: LIST,
      key: 'Home',
      expect: [
        { selector: ITEM, index: 0, read: 'tabindex', equals: '0' },
        { selector: ITEM, index: 1, read: 'tabindex', equals: '-1' },
        { selector: ITEM, index: 2, read: 'tabindex', equals: '-1' },
      ],
    },
  ],
}
