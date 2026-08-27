import type { PropType } from 'vue'
import { tableControlProps } from './controlProps'
import type {
  IrisTableCellEditEvent,
  IrisTableClipConfig,
  IrisTableColumn,
  IrisTableColumnDrag,
  IrisTableColumnVisibility,
  IrisTableContextMenuConfig,
  IrisTableFilterValues,
  IrisTableFormulaTables,
  IrisTableFormConfig,
  IrisTableProxyConfig,
  IrisTableRenderDetail,
  IrisTableRowDrag,
  IrisTableRowExpandable,
  IrisTableSortState,
  IrisTableSpan,
  IrisTableSpanMethodParams,
  IrisTableToolbarConfig,
  IrisTableVirtualOptions,
  IrisTableColumnWidths,
  IrisTableDensity,
  IrisTableTab,
  IrisTableViewConfig,
} from './types'

/** Runtime props for the Vue table renderer. Kept separate from setup/render logic. */
export const tableProps = {
  columns: {
    type: Array as PropType<IrisTableColumn<Record<string, unknown>>[]>,
    required: true,
  },
  data: {
    type: Array as PropType<Array<Record<string, unknown>>>,
    required: false,
    default: undefined,
  },
  rowKey: { type: String, default: 'id' },
  ...tableControlProps,
  /** Multi-column sort (vxe sort-config.multiple parity). */
  multiSort: { type: Boolean, default: false },
  multiSortState: {
    type: Array as PropType<IrisTableSortState[]>,
    default: undefined,
  },
  defaultMultiSort: {
    type: Array as PropType<IrisTableSortState[]>,
    default: undefined,
  },
  striped: { type: Boolean, default: false },
  editConfig: {
    type: Object as PropType<{
      trigger?: 'click' | 'dblclick' | 'manual'
      showAsterisk?: boolean
      autoClear?: boolean
      mode?: 'cell' | 'row'
    }>,
    default: undefined,
  },
  bordered: { type: Boolean, default: true },
  /** Row-density preset; invalid runtime values fail closed to comfortable. */
  density: {
    type: String as PropType<IrisTableDensity>,
    default: 'comfortable',
  },
  /** Show the local density cycle button in the table toolbar. */
  densityToggle: { type: Boolean, default: false },
  /** Show a live formatter preview while an editor is open. */
  editPreview: { type: Boolean, default: false },
  /** Highlight committed cells matching the active inline draft. */
  pattern: { type: Boolean, default: false },
  /** Alias for pattern feedback. */
  patternFill: { type: Boolean, default: false },
  /** Named snapshots available in the table toolbar. */
  views: { type: Object as PropType<IrisTableViewConfig>, default: undefined },
  /** Controlled active named view notification. */
  onActiveViewChange: {
    type: Function as PropType<(key: string | null) => void>,
    default: undefined,
  },
  /** Optional tab strip; tab clicks apply listed view names in order. */
  tableTabs: { type: Array as PropType<IrisTableTab[]>, default: undefined },
  /** Show a draggable boundary for the leading left-pinned columns. */
  pinnedDrag: { type: Boolean, default: false },
  /** Called for each column whose pin side changes. */
  onColumnPinnedChange: {
    type: Function as PropType<(key: string, side: 'left' | 'right' | null) => void>,
    default: undefined,
  },
  /** Called once after a pinned-boundary commit. */
  onPinnedCountChange: { type: Function as PropType<(count: number) => void>, default: undefined },
  /** Infer leaf-column value kinds from the first non-empty data arrival and
   * fill only missing alignment defaults. Disabled by default. */
  autoDetectTypes: { type: Boolean, default: false },
  /** Below 480px, greedily hide the lowest-priority top-level columns until
   * the natural width fits; pinned columns survive. */
  responsive: { type: Boolean, default: false },
  /**
   * External row sets for `table!field` formula references. The first row of
   * the named set is read; replace the object when referenced rows change.
   */
  formulaTables: {
    type: Object as PropType<IrisTableFormulaTables<Record<string, unknown>>>,
    default: undefined,
  },
  /** Extra bare row sets appended as named CSV segments by the imperative handle. */
  exportNames: {
    type: Array as PropType<Array<{ key: string; ref: () => Array<Record<string, unknown>> }>>,
    default: undefined,
  },
  resizableColumns: { type: Boolean, default: false },
  columnWidths: {
    type: Object as PropType<IrisTableColumnWidths>,
    default: undefined,
  },
  virtualScroll: {
    type: Object as PropType<IrisTableVirtualOptions>,
    default: undefined,
  },
  loading: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
  /** Print-friendly mode: marks the root so toolbar/form chrome is hidden by print CSS. */
  printable: { type: Boolean, default: false },
  /** Show a token-styled back-to-top button for the table's effective scroller. */
  scrollToTop: { type: Boolean, default: false },
  /** Show a confirmation preview before the toolbar CSV import callback. */
  importPreview: { type: Boolean, default: false },
  onRetry: { type: Function as PropType<(() => void) | undefined>, default: undefined },
  columnVirtualization: { type: Boolean, default: false },
  keyboardNavigation: { type: Boolean, default: false },
  cellRange: { type: Boolean, default: false },
  /** Range clipboard copy; copyWithFormat uses column formatter output. */
  clipConfig: { type: Object as PropType<IrisTableClipConfig>, default: undefined },
  /** Enable built-in row-list undo/redo history; default off. */
  undo: { type: Boolean, default: false },
  renderDetail: {
    type: Function as PropType<IrisTableRenderDetail<Record<string, unknown>>>,
    default: undefined,
  },
  rowExpandable: {
    type: Function as PropType<IrisTableRowExpandable<Record<string, unknown>>>,
    default: undefined,
  },
  defaultExpandedRowKeys: {
    type: Array as PropType<Array<string | number>>,
    default: undefined,
  },
  getSubRows: {
    type: Function as PropType<
      (row: Record<string, unknown>) => Array<Record<string, unknown>> | undefined
    >,
    default: undefined,
  },
  treeSelectionCascade: { type: Boolean, default: false },
  proxyConfig: {
    type: Object as PropType<IrisTableProxyConfig<Record<string, unknown>>>,
    default: undefined,
  },
  formConfig: {
    type: Object as PropType<IrisTableFormConfig>,
    default: undefined,
  },
  toolbar: {
    type: Object as PropType<IrisTableToolbarConfig>,
    default: undefined,
  },
  /** Audit log (batch EN, iris 独有 — mirror react batch AT): when true,
   * every mutation commit appends ONE entry to a bounded (200) ring —
   * inline/row cell edits (recorded directly at the commit point, type
   * 'edit' + rowKey + column + old→new) and the row-list funnels available
   * here (removeRows — list diff, type 'remove'; loadData — list diff, type
   * 'edit', react commitRowList default parity). External re-feeds (parent
   * data / proxy refetch / rowDrag reorder) re-baseline the diff snapshot
   * and never record. The toolbar gains an audit trigger
   * (`data-iris-audit-trigger`) opening a floating panel
   * (`data-iris-audit-panel`, like the filter/context panels — Esc /
   * outside / scroll close) listing newest-first entries (seq +
   * `formatClock` time + type + rowKey + column + muted old→new);
   * `getAuditLog()` / `clearAuditLog()` on the exposed handle access the
   * trail programmatically (the seq never resets on clear — audit
   * integrity). Requires a toolbar render (the gate admits `auditLog` like
   * `densityToggle`). Additive — default off; off = zero push.
   */
  auditLog: { type: Boolean, default: false },
  columnVisibility: {
    type: Object as PropType<IrisTableColumnVisibility>,
    default: undefined,
  },
  /** Controlled top-level presentation order; omitted keys retain source order. */
  columnOrder: {
    type: Array as PropType<string[]>,
    default: undefined,
  },
  /** Animate controlled column show/hide transitions; disabled by default. */
  columnFade: { type: Boolean, default: false },
  filters: {
    type: Object as PropType<Record<string, string>>,
    default: undefined,
  },
  filterValues: {
    type: Object as PropType<IrisTableFilterValues>,
    default: undefined,
  },
  onFilterValuesChange: {
    type: Function as PropType<(next: IrisTableFilterValues) => void>,
    default: undefined,
  },
  contextMenu: {
    type: Object as PropType<IrisTableContextMenuConfig<Record<string, unknown>>>,
    default: undefined,
  },
  lazyLoad: {
    type: Function as PropType<
      (
        row: Record<string, unknown>,
        load: (children: Array<Record<string, unknown>>) => void,
      ) => void
    >,
    default: undefined,
  },
  seq: { type: Boolean, default: false },
  seqStartIndex: { type: Number, default: 1 },
  spanMethod: {
    type: Function as PropType<(params: IrisTableSpanMethodParams) => IrisTableSpan | null>,
    default: undefined,
  },
  columnDrag: {
    type: Object as PropType<IrisTableColumnDrag>,
    default: undefined,
  },
  rowDrag: {
    type: Object as PropType<IrisTableRowDrag>,
    default: undefined,
  },
  onDataChange: {
    type: Function as PropType<(rows: Array<Record<string, unknown>>) => void>,
    default: undefined,
  },
} as const

export type TableProps = typeof tableProps

export type TableEmitters = {
  'update:selection': (value: Array<string | number>) => boolean
  'update:sort': (value: IrisTableSortState | null) => boolean
  'update:multiSortState': (value: IrisTableSortState[]) => boolean
  multiSortChange: (value: IrisTableSortState[]) => boolean
  'update:columnWidths': (value: IrisTableColumnWidths) => boolean
  'update:columnVisibility': (value: IrisTableColumnVisibility) => boolean
  'update:columnOrder': (value: string[] | undefined) => boolean
  rowClick: (row: Record<string, unknown>, index: number) => boolean
  rowDblclick: (row: Record<string, unknown>, index: number) => boolean
  cellEdit: (payload: IrisTableCellEditEvent<Record<string, unknown>>) => boolean
  expandedRowsChange: (keys: Array<string | number>) => boolean
}
