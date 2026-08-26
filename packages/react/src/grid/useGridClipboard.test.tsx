import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { GridClipboardModel, GridCore } from '@iris-ui-kit/core/grid'
import type { GridClipboardCopyChange, TableClipboardColumn } from '@iris-ui-kit/core'
import { useGridClipboard } from './useGridClipboard'
import { useGridCore } from './useGridCore'
import { useGridRange } from './useGridRange'
import { useGridRows } from './useGridRows'

afterEach(cleanup)

type Row = { id: number; name: string }

const columns: TableClipboardColumn<Row>[] = [{ key: 'name', title: 'Name' }]

describe('useGridClipboard', () => {
  it('shares the feature-owned model and applies paste through the rows bridge', () => {
    let core: GridCore<Row> | undefined
    let model: GridClipboardModel | undefined
    let serialize: (() => string | null) | undefined
    let paste: ((text: string) => boolean) | undefined

    function Harness(): React.ReactElement {
      core = useGridCore<Row>()
      const rows = useGridRows(core, [{ id: 1, name: 'Ada' }])
      useGridRange(core)
      const clipboard = useGridClipboard(core, { getColumns: () => columns })
      model = clipboard.model
      serialize = clipboard.serialize
      paste = clipboard.paste
      return <span>{rows.rows[0]?.name}</span>
    }

    render(<Harness />)
    act(() => core?.invoke('startCellRange', 0, 0))

    expect(core?.hasFeature('clipboard')).toBe(true)
    expect(core?.invoke('getClipboardModel')).toBe(model)
    expect(serialize?.()).toBe('Ada')
    act(() => expect(paste?.('Grace')).toBe(true))
    expect(screen.getByText('Grace')).toBeTruthy()
  })

  it('reads the latest defaults and callbacks without replacing the model', () => {
    let core: GridCore<Row> | undefined
    let model: GridClipboardModel | undefined
    let serialize: (() => string | null) | undefined
    const first = vi.fn<(change: GridClipboardCopyChange) => void>()
    const second = vi.fn<(change: GridClipboardCopyChange) => void>()

    function Harness({ csv, onCopy }: { csv: boolean; onCopy: typeof first }): null {
      core = useGridCore<Row>()
      useGridRows(core, [{ id: 1, name: 'Ada, Lovelace' }])
      useGridRange(core)
      const clipboard = useGridClipboard(core, {
        getColumns: () => columns,
        copyFormat: csv ? 'csv' : 'tsv',
        onCopy,
      })
      model = clipboard.model
      serialize = clipboard.serialize
      return null
    }

    const rendered = render(<Harness csv={false} onCopy={first} />)
    act(() => core?.invoke('startCellRange', 0, 0))
    const original = model
    rendered.rerender(<Harness csv onCopy={second} />)

    expect(serialize?.()).toBe('"Ada, Lovelace"')
    expect(model).toBe(original)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })
})
