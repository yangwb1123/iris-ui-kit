import type { ReactNode } from 'react'
import type { IrisTableFormField } from './types'
import type { IrisTableAdvancedProps } from './props/advanced'
import type { IrisTableEditingProps } from './props/editing'
import type { IrisTableLayoutProps } from './props/layout'
import type { IrisTableQueryProps } from './props/query'
/**
 * vxe-grid proxyConfig parity — the server-side data proxy (query slice).
 * When set, `data` is ignored: rows come from `query` (paged), the table
 * renders a pager below the body, and edit write-back keeps working.
 */
export interface IrisTableProxyConfig<Row extends Record<string, unknown>> {
  /**
   * Fetch one page. 1-based `page`; `sort`/`filters` are the ACTIVE state,
   * passed through when `remoteSort`/`remoteFilter` are enabled.
   */
  query: (
    params: import('./types').IrisTableProxyQueryParams,
  ) => Promise<{ rows: Row[]; total: number }>
  /** Auto-load the first page on mount (vxe autoLoad parity). Default true. */
  autoLoad?: boolean
  /** Sort changes re-query the server instead of sorting client-side (vxe proxyConfig.sort). Default false. */
  remoteSort?: boolean
  /** Filter changes re-query the server instead of filtering client-side (vxe proxyConfig.filter). Default false. */
  remoteFilter?: boolean
  /** Rows per page. Default 10. */
  pageSize?: number
  /** Initial page (1-based). Default 1. */
  defaultPage?: number
  /** Cumulative sequence numbers across pages (batch L): with the table `seq`
   * prop, the seq cell renders `(page - 1) * pageSize + rowIndex + 1` instead of `rowIndex + seqStartIndex`. `seqMethod` still wins. */
  seq?: boolean
  /** Fired when the page changes. */
  onPageChange?: (page: number, pageSize: number) => void
}

/**
 * Search-form configuration (vxe-grid formConfig parity): a field row above
 * the toolbar; submit merges values into the filters (client-side or proxy).
 */
export interface IrisTableFormConfig {
  fields: IrisTableFormField[]
  /** Label of the submit button. Defaults to the i18n `table.formSubmit` key. */
  submitText?: string
  /** Label of the reset button. Defaults to the i18n `table.formReset` key. */
  resetText?: string
  /** Fired on submit with every field's value (empty strings stripped). */
  onSearch?: (values: Record<string, string>) => void
  /** Fired on reset with the reset values (defaults re-applied). */
  onReset?: (values: Record<string, string>) => void
}

/** Empty-state descriptor (iris 独有 — vxe has no empty-state action button):
 * object form of `emptyState` renders centered text (optional) plus an inline
 * action button. A plain ReactNode stays on the node path untouched. */
export interface IrisTableEmptyState {
  /** Empty-state text (falls back to the localized default when omitted). */
  text?: ReactNode
  /** Action button rendered inline after the text. */
  action?: { label: string; onClick: () => void }
}

/** Pager configuration (vxe-grid pagerConfig parity). */
export interface IrisTablePagerConfig {
  /** Rows-per-page options rendered as a size selector next to the pager. A
   * change re-queries with the new size and resets the page to 1. */
  pageSizes?: number[]
  /** Show the total-row count (i18n `table.total`) before the size selector (vxe pagerConfig.showTotal parity). */
  showTotal?: boolean
}

/** Public input surface for the React table adapter. */
/** Row-density preset (iris 独有 — vxe has no density concept): the three
 * tiers stack ON TOP of `size` — both write `--iris-cell-pad-y`, and the
 * density rules come later in the stylesheet (same specificity, later
 * wins). Default comfortable. */
export type IrisTableDensity = 'comfortable' | 'compact' | 'cozy'

export interface IrisTableProps<Row extends Record<string, unknown> = Record<string, unknown>>
  extends
    IrisTableLayoutProps<Row>,
    IrisTableEditingProps<Row>,
    IrisTableQueryProps<Row>,
    IrisTableAdvancedProps<Row> {}
