import type { ContractScenario } from '../types'

const RESIZE_HANDLE = '[data-iris-table-resize-handle=""]'
const COL_WIDTH = '[data-col-width]'

/**
 * Shared Table column-resize behavior via keyboard. Each adapter mounts a table
 * with `resizableColumns`, two columns, and the first column's width CONTROLLED
 * at an initial 200px, then runs this. The harness also renders a probe element
 * `<… data-col-width={firstColumnWidth} />` so the resize result is observable
 * in jsdom (which has no layout).
 *
 * The resize handle is focusable (`tabIndex={0}`) and responds to ArrowLeft /
 * ArrowRight by calling `onResize(key, clamp(width ± RESIZE_STEP))` with
 * `RESIZE_STEP === 16` (identical across all four adapters). Because the width
 * is controlled at 200, `measure()` returns the explicit override (not the
 * degenerate `getBoundingClientRect().width` of 0), so the sequence is
 * deterministic: 200 → ArrowRight → 216 → ArrowLeft → 200.
 *
 * Every step asserts (no setup-only steps) so the assertion-density guard holds
 * and a broken resize cannot pass green.
 */
export const tableColumnResizeScenario: ContractScenario = {
  name: 'TableColumnResize',
  description:
    'Focusing a column resize handle and pressing ArrowRight/ArrowLeft adjusts the controlled column width by ±16px.',
  steps: [
    {
      label: 'initial: two resize handles, first column width 200',
      action: 'none',
      expect: [
        { selector: RESIZE_HANDLE, read: 'count', equals: 2 },
        { selector: COL_WIDTH, read: 'data-col-width', equals: '200' },
      ],
    },
    {
      label: 'focus first resize handle (width unchanged)',
      action: 'click',
      target: RESIZE_HANDLE,
      index: 0,
      expect: [{ selector: COL_WIDTH, read: 'data-col-width', equals: '200' }],
    },
    {
      label: 'press ArrowRight → column widens to 216',
      action: 'keydown',
      target: RESIZE_HANDLE,
      index: 0,
      key: 'ArrowRight',
      expect: [{ selector: COL_WIDTH, read: 'data-col-width', equals: '216' }],
    },
    {
      label: 'press ArrowLeft → column narrows back to 200',
      action: 'keydown',
      target: RESIZE_HANDLE,
      index: 0,
      key: 'ArrowLeft',
      expect: [{ selector: COL_WIDTH, read: 'data-col-width', equals: '200' }],
    },
  ],
}
