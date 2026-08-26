import * as React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useGridColumns } from './useGridColumns'
import { useGridCore } from './useGridCore'

describe('useGridColumns', () => {
  it('bridges uncontrolled widths and pinned null overrides', () => {
    const onWidthsChange = vi.fn()
    const onPinnedChange = vi.fn()
    function Harness() {
      const core = useGridCore()
      const columns = useGridColumns(core, {
        defaultWidths: { name: 100 },
        onWidthsChange,
        onPinnedChange,
      })
      return (
        <button
          type="button"
          onClick={() => {
            columns.setWidth('name', 140)
            columns.setPinned('name', null)
          }}
        >
          {columns.state.widths.name}/{String(columns.state.pinned.name)}
        </button>
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button'))

    expect(view.getByRole('button').textContent).toBe('140/null')
    expect(onWidthsChange).toHaveBeenLastCalledWith({ name: 140 })
    expect(onPinnedChange).toHaveBeenLastCalledWith('name', null)
    view.unmount()
  })

  it('rebases controlled visibility and preserves an undefined controlled order', () => {
    const onVisibilityChange = vi.fn()
    const onOrderChange = vi.fn()
    function Harness({ visibility }: { visibility: Record<string, boolean> }) {
      const core = useGridCore()
      const columns = useGridColumns(core, {
        visibility,
        orderControlled: true,
        onVisibilityChange,
        onOrderChange,
      })
      return (
        <button
          type="button"
          onClick={() => {
            columns.toggleVisibility('age')
            columns.clearOrder()
          }}
        >
          {String(columns.state.visibility.age)}/{columns.state.order.length}
        </button>
      )
    }

    const view = render(<Harness visibility={{ age: false }} />)
    fireEvent.click(view.getByRole('button'))

    expect(view.getByRole('button').textContent).toBe('false/0')
    expect(onVisibilityChange).toHaveBeenLastCalledWith({ age: true })
    expect(onOrderChange).toHaveBeenLastCalledWith(undefined)
    view.unmount()
  })
})
