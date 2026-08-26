import { cleanup, renderHook } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import type { GridClipboardModel, GridCore } from '@iris-ui-kit/core/grid'
import type { TableClipboardColumn } from '@iris-ui-kit/core'
import { useGridClipboard } from './useGridClipboard'
import { useGridCore, useGridRange, useGridRows } from './index'

afterEach(cleanup)

type Row = { id: number; name: string }

const columns: TableClipboardColumn<Row>[] = [{ key: 'name', title: 'Name' }]

describe('useGridClipboard', () => {
  it('shares the feature-owned model and routes paste through the rows bridge', () => {
    const { result } = renderHook(() => {
      const core = useGridCore<Row>()
      const rows = useGridRows(core, [{ id: 1, name: 'Ada' }])
      useGridRange(core)
      const clipboard = useGridClipboard(core, { getColumns: () => columns })
      return { core, rows, clipboard }
    })

    const model = result.clipboard.model as GridClipboardModel
    expect(result.core.hasFeature('clipboard')).toBe(true)
    expect(result.core.invoke('getClipboardModel')).toBe(model)
    result.core.invoke('startCellRange', 0, 0)
    expect(result.clipboard.serialize()).toBe('Ada')
    expect(result.clipboard.paste('Grace')).toBe(true)
    expect(result.rows.rows()[0]?.name).toBe('Grace')
  })

  it('preserves the bridge row type for a computed column mapping', () => {
    let core: GridCore<Row> | undefined
    let model: GridClipboardModel | undefined
    renderHook(() => {
      core = useGridCore<Row>()
      useGridRows(core, [{ id: 1, name: 'Ada' }])
      useGridRange(core)
      model = useGridClipboard(core, {
        getColumns: () => columns,
        getRows: () => [{ id: 1, name: 'ADA' }],
      }).model
    })

    core?.invoke('startCellRange', 0, 0)
    expect(model?.serialize()).toBe('ADA')
  })
})
