import type { ContractScenario } from '../types'

const GRID = '[data-iris-calendar-grid]'
const TITLE = '[data-iris-calendar-title]'
const DAY = (iso: string) => `[data-iris-calendar-day-iso="${iso}"]`

/**
 * Shared Calendar keyboard-roving behavior (2D grid semantics sunk to core
 * `createCalendarNav`). Each adapter mounts with `defaultMonth` = June 2024,
 * a SEEDED value `2024-06-10` (so the initial roving focus is deterministic),
 * `min` = 2024-06-10, `max` = 2024-07-20 and `locale` = "en-US" (the runner
 * compares titles as exact strings — no regex).
 *
 * Focus is asserted via `tabindex` ('0' on the focused cell, '-1' elsewhere),
 * NOT `data-state` — on the seeded value cell `selected` wins over `focused`.
 * Disabled cells expose `aria-disabled="true"`; enabled cells have the
 * attribute ABSENT (null), per the `'true' : undefined` pattern in all four
 * adapters.
 *
 * Verified matrices (weekStartsOn = 0): June 2024 row 2 = 06-09…06-15 (06-09 <
 * min ⇒ disabled); July 2024 rows 0–2 = 06-30…07-20 all enabled, row 3+ beyond
 * max ⇒ disabled. Steps 7/10/11 pin the registered grid-semantics changes;
 * steps 12–13 pin PageUp/PageDown clamp+flip.
 */
export const calendarNavScenario: ContractScenario = {
  name: 'CalendarNav',
  description:
    'Arrow/Home/End/PageUp/PageDown grid roving: row-bounded movement, disabled-cell skipping, month flip + clamp on PageUp/PageDown.',
  steps: [
    {
      label: 'initial: June, focus 06-10, 06-09 disabled',
      action: 'none',
      expect: [
        { selector: TITLE, read: 'text', equals: 'June 2024' },
        { selector: DAY('2024-06-10'), read: 'tabindex', equals: '0' },
        { selector: DAY('2024-06-11'), read: 'tabindex', equals: '-1' },
        { selector: DAY('2024-06-09'), read: 'aria-disabled', equals: 'true' },
        { selector: DAY('2024-06-10'), read: 'aria-disabled', equals: null },
      ],
    },
    {
      label: 'ArrowRight → 06-11',
      action: 'keydown',
      target: GRID,
      key: 'ArrowRight',
      expect: [
        { selector: DAY('2024-06-11'), read: 'tabindex', equals: '0' },
        { selector: DAY('2024-06-10'), read: 'tabindex', equals: '-1' },
      ],
    },
    {
      label: 'ArrowRight → 06-12',
      action: 'keydown',
      target: GRID,
      key: 'ArrowRight',
      expect: [{ selector: DAY('2024-06-12'), read: 'tabindex', equals: '0' }],
    },
    {
      label: 'ArrowRight → 06-13',
      action: 'keydown',
      target: GRID,
      key: 'ArrowRight',
      expect: [{ selector: DAY('2024-06-13'), read: 'tabindex', equals: '0' }],
    },
    {
      label: 'ArrowRight → 06-14',
      action: 'keydown',
      target: GRID,
      key: 'ArrowRight',
      expect: [{ selector: DAY('2024-06-14'), read: 'tabindex', equals: '0' }],
    },
    {
      label: 'ArrowRight → 06-15 (row 2 end)',
      action: 'keydown',
      target: GRID,
      key: 'ArrowRight',
      expect: [{ selector: DAY('2024-06-15'), read: 'tabindex', equals: '0' }],
    },
    {
      label: 'ArrowRight at row end STAYS (no wrap, no month flip)',
      action: 'keydown',
      target: GRID,
      key: 'ArrowRight',
      expect: [
        { selector: DAY('2024-06-15'), read: 'tabindex', equals: '0' },
        { selector: TITLE, read: 'text', equals: 'June 2024' },
      ],
    },
    {
      label: 'ArrowDown → 06-22',
      action: 'keydown',
      target: GRID,
      key: 'ArrowDown',
      expect: [{ selector: DAY('2024-06-22'), read: 'tabindex', equals: '0' }],
    },
    {
      label: 'ArrowUp → 06-15',
      action: 'keydown',
      target: GRID,
      key: 'ArrowUp',
      expect: [{ selector: DAY('2024-06-15'), read: 'tabindex', equals: '0' }],
    },
    {
      label: 'Home skips disabled 06-09 → nearest enabled 06-10',
      action: 'keydown',
      target: GRID,
      key: 'Home',
      expect: [{ selector: DAY('2024-06-10'), read: 'tabindex', equals: '0' }],
    },
    {
      label: 'ArrowLeft blocked by disabled 06-09 → stays 06-10',
      action: 'keydown',
      target: GRID,
      key: 'ArrowLeft',
      expect: [
        { selector: DAY('2024-06-10'), read: 'tabindex', equals: '0' },
        { selector: DAY('2024-06-11'), read: 'tabindex', equals: '-1' },
      ],
    },
    {
      label: 'PageDown: flip + clamp → July, focus 07-10',
      action: 'keydown',
      target: GRID,
      key: 'PageDown',
      expect: [
        { selector: TITLE, read: 'text', equals: 'July 2024' },
        { selector: DAY('2024-07-10'), read: 'tabindex', equals: '0' },
      ],
    },
    {
      label: 'PageUp: flip back → June, focus 06-10',
      action: 'keydown',
      target: GRID,
      key: 'PageUp',
      expect: [
        { selector: TITLE, read: 'text', equals: 'June 2024' },
        { selector: DAY('2024-06-10'), read: 'tabindex', equals: '0' },
      ],
    },
  ],
}
