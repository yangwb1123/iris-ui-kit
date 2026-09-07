import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
}

const rows: Row[] = [{ id: 1, a: 'x', b: 'y', c: 'z' }]

const header = (key: string): HTMLElement =>
  document.querySelector(`[data-iris-table-header="${key}"]`) as HTMLElement

describe('@iris-ui-kit/react IrisTable pinned-count boundary drag (batch CV, iris 独有 — vxe has no pinned boundary handle)', () => {
  it('restores static pins when the controlled map is removed', () => {
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', pinned: 'left' },
      { key: 'b', title: 'B' },
    ]
    const view = render(
      <IrisTable
        columns={pinnedCols}
        data={rows}
        rowKey="id"
        pinnedDrag
        pinnedColumns={{ a: null }}
      />,
    )
    expect(header('a').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(view.container.querySelector('[data-iris-pinned-drag-handle]')).toBeNull()

    view.rerender(<IrisTable columns={pinnedCols} data={rows} rowKey="id" pinnedDrag />)

    expect(header('a').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(view.container.querySelector('[data-iris-pinned-drag-handle]')).not.toBeNull()
  })
})
