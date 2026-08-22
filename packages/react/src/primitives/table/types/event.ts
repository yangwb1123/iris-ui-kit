import type { IrisTableCellClickParams, IrisTableFilterValues, IrisTableSortState } from './base'
import type { IrisTableEditClosedParams, IrisTableEditStartParams } from './footer'

/**
 * Unified event stream palette (batch DW, iris 独有 — vxe has no single event
 * bus): the `type` names one of the closed event families; `detail` carries
 * the SAME params the matching dedicated callback receives (reference-
 * identical `row`/`column`). Events fire AFTER the dedicated callback — the
 * bus is a bridge, not a behavior. Controllable proxy `sort` updates (a
 * parent-driven `sort`/`multiSortState` prop change — not a user click) fire
 * no event. The expansion family mirrors the shared `onExpandedRowsChange`
 * channel: EVERY model commit fires `expanded-rows-change` — user toggles,
 * `expandAll` seeding, and `persistState`/view `expandedKeys` restores all
 * replay through the expansion model's `onChange` (a restore still needs
 * `onExpandedRowsChange` + an expandable table — the same gate as the
 * dedicated callback).
 */
export type IrisTableEvent<Row = Record<string, unknown>> =
  | { type: 'cell-click'; detail: IrisTableCellClickParams<Row> }
  | { type: 'cell-dblclick'; detail: IrisTableCellClickParams<Row> }
  | { type: 'row-click'; detail: { row: Row; rowIndex: number } }
  | { type: 'row-dblclick'; detail: { row: Row; rowIndex: number } }
  | { type: 'sort-change'; detail: { sort: IrisTableSortState | null } }
  | { type: 'multi-sort-change'; detail: { sorts: IrisTableSortState[] } }
  | { type: 'filter-change'; detail: { filters: Record<string, string> } }
  | { type: 'filter-value-change'; detail: { filterValues: IrisTableFilterValues } }
  | { type: 'edit-start'; detail: IrisTableEditStartParams<Row> }
  | { type: 'edit-commit'; detail: IrisTableEditClosedParams<Row> }
  | { type: 'edit-cancel'; detail: IrisTableEditClosedParams<Row> }
  | { type: 'expand-change'; detail: { row: Row; expanded: boolean } }
  | { type: 'tree-expand-change'; detail: { row: Row; expanded: boolean } }
  | { type: 'expanded-rows-change'; detail: { expandedKeys: string[] } }
