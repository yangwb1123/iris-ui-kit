export type IrisTableSortDirection = 'asc' | 'desc'

export interface IrisTableSortState {
  key: string
  direction: IrisTableSortDirection
}

export type IrisTableEditor = 'text' | 'number'

export interface IrisTableColumn<Row = Record<string, unknown>> {
  key: string
  title: string
  dataIndex?: keyof Row | string
  sortable?: boolean
  width?: number | string
  minWidth?: number
  maxWidth?: number
  align?: 'left' | 'center' | 'right'
  pinned?: 'left' | 'right'
  sorter?: (a: Row, b: Row) => number
  editable?: boolean
  editor?: IrisTableEditor
  /** Custom cell render function. */
  renderCell?: (row: Row, index: number) => JSX.Element
}

export interface IrisTableCellEditEvent<Row = Record<string, unknown>> {
  row: Row
  column: IrisTableColumn<Row>
  oldValue: unknown
  newValue: unknown
  rowIndex: number
}

export type IrisTableColumnWidths = Record<string, number>

import type { JSX } from 'solid-js'
