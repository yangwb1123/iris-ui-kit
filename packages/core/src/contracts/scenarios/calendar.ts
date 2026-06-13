import type { ContractScenario } from '../types'

const DAY10 = '[data-iris-calendar-day-iso="2024-06-10"]'
const DAY20 = '[data-iris-calendar-day-iso="2024-06-20"]'

/**
 * Shared Calendar day-selection behavior. Each adapter mounts a calendar fixed to
 * **June 2024** (`defaultMonth` = `new Date(2024, 5, 1)`) with no initial
 * selection (React/Solid uncontrolled `defaultValue`; Vue/Svelte a model harness
 * holding `null`), then runs this. Fixing the month makes the day cells
 * deterministic: each carries `data-iris-calendar-day-iso="YYYY-MM-DD"` +
 * `aria-selected` ("true"/"false"). Clicking a day selects it (single-date) and
 * deselects the previously-selected one. Asserts identical date-selection state
 * across all four adapters.
 */
export const calendarScenario: ContractScenario = {
  name: 'Calendar',
  description:
    'Clicking a day sets its aria-selected="true" and clears the prior day (single date).',
  steps: [
    {
      label: 'initial: nothing selected',
      action: 'none',
      expect: [
        { selector: DAY10, read: 'count', equals: 1 },
        { selector: DAY10, read: 'aria-selected', equals: 'false' },
        { selector: DAY20, read: 'aria-selected', equals: 'false' },
      ],
    },
    {
      label: 'click June 10 → selected',
      action: 'click',
      target: DAY10,
      expect: [
        { selector: DAY10, read: 'aria-selected', equals: 'true' },
        { selector: DAY20, read: 'aria-selected', equals: 'false' },
      ],
    },
    {
      label: 'click June 20 → selection moves',
      action: 'click',
      target: DAY20,
      expect: [
        { selector: DAY20, read: 'aria-selected', equals: 'true' },
        { selector: DAY10, read: 'aria-selected', equals: 'false' },
      ],
    },
  ],
}
