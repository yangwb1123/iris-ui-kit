import { createMemo, type Accessor } from 'solid-js'
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
    const parts: string[] = []
    if (options.rowDrag()) parts.push(`${40}px`)
    if (options.seq()) parts.push(`${SEQ_COL_WIDTH}px`)
    if (options.hasDetail()) parts.push(`${EXPAND_COL_WIDTH}px`)
    if (options.selectable()) parts.push(`${SELECTION_COL_WIDTH}px`)
    for (const column of options.leafColumns()) {
      if (options.isCollapsed(column.key)) {
        parts.push('0px')
        continue
      }
      const width = options.widths()[column.key]
      // Keep the pre-fade Solid bridge's authored and fallback track semantics.
      if (width != null) parts.push(`${width}px`)
      else if (typeof column.width === 'number') parts.push(`${column.width}px`)
      else if (column.width === 'auto') parts.push('minmax(max-content, max-content)')
      else if (typeof column.width === 'string') parts.push(column.width)
      else parts.push('minmax(0, 1fr)')
    }
    return parts.join(' ')
  })
}
