import { createMemo, type Accessor } from 'solid-js'
import { resolveGridTemplateColumns } from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'

const SELECTION_COL_WIDTH = 40
const EXPAND_COL_WIDTH = 40
const SEQ_COL_WIDTH = 60

/** Build the shared CSS-grid tracks for headers, body, summaries, and details. */
export function createTableGridTemplate<Row extends Record<string, unknown>>(options: {
  leafColumns: Accessor<IrisTableColumn<Row>[]>
  widths: Accessor<Record<string, number>>
  rowDrag: Accessor<boolean>
  seq: Accessor<boolean>
  hasDetail: Accessor<boolean>
  selectable: Accessor<boolean>
  isCollapsed: (key: string) => boolean
}): Accessor<string> {
  return createMemo(() => {
    return resolveGridTemplateColumns(options.leafColumns(), options.widths(), {
      leadingTracks: [
        ...(options.rowDrag() ? [40] : []),
        ...(options.seq() ? [SEQ_COL_WIDTH] : []),
        ...(options.hasDetail() ? [EXPAND_COL_WIDTH] : []),
        ...(options.selectable() ? [SELECTION_COL_WIDTH] : []),
      ],
      isCollapsed: (column) => options.isCollapsed(column.key),
    })
  })
}
