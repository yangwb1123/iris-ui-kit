import type { ContractScenario } from '../types'

const EDITABLE_CELL = '[data-editable=""]'
const EDITOR_INPUT = '[data-iris-table-editor=""]'

/**
 * Shared Table inline cell-edit behavior. Each adapter mounts a table with one
 * editable column (`editable: true`) and three rows, then runs this. Editing
 * starts on double-click (`onDoubleClick`); the editor input carries
 * `data-iris-table-editor=""` and the cell gets `data-editing=""`. Commit is
 * Enter (or blur), cancel is Escape.
 *
 * Scenario: idle → double-click → editor opens → type → Enter → editor closes.
 * Then: double-click → Escape → editor closes without committing.
 */
export const tableCellEditScenario: ContractScenario = {
  name: 'TableCellEdit',
  description:
    'Double-clicking an editable cell opens the inline editor; Enter commits, Escape cancels.',
  steps: [
    {
      label: 'initial: editable cells visible, no editor',
      action: 'none',
      expect: [
        { selector: EDITABLE_CELL, read: 'count', equals: 3 },
        { selector: EDITOR_INPUT, read: 'count', equals: 0 },
      ],
    },
    {
      label: 'double-click first cell → editor opens',
      action: 'dblclick',
      target: EDITABLE_CELL,
      index: 0,
      expect: [{ selector: EDITOR_INPUT, read: 'count', equals: 1 }],
    },
    {
      label: 'editor is focused with current cell value',
      action: 'none',
      expect: [{ selector: EDITOR_INPUT, read: 'value', equals: 'Charlie' }],
    },
    {
      label: 'type a new value → editor reflects it',
      action: 'type',
      target: EDITOR_INPUT,
      typeText: 'Alice',
      expect: [{ selector: EDITOR_INPUT, read: 'value', equals: 'Alice' }],
    },
    {
      label: 'press Enter to commit → editor closes',
      action: 'keydown',
      target: EDITOR_INPUT,
      key: 'Enter',
      expect: [{ selector: EDITOR_INPUT, read: 'count', equals: 0 }],
    },
    {
      label: 'double-click first cell again → editor opens',
      action: 'dblclick',
      target: EDITABLE_CELL,
      index: 0,
      expect: [{ selector: EDITOR_INPUT, read: 'count', equals: 1 }],
    },
    {
      label: 'press Escape to cancel → editor closes',
      action: 'keydown',
      target: EDITOR_INPUT,
      key: 'Escape',
      expect: [{ selector: EDITOR_INPUT, read: 'count', equals: 0 }],
    },
    {
      label: 'double-click second cell → editor opens',
      action: 'dblclick',
      target: EDITABLE_CELL,
      index: 1,
      expect: [{ selector: EDITOR_INPUT, read: 'count', equals: 1 }],
    },
    {
      label: 'second cell editor shows its own value',
      action: 'none',
      expect: [{ selector: EDITOR_INPUT, read: 'value', equals: 'Alpha' }],
    },
  ],
}
