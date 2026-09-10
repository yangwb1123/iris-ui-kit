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

  it('restores the last uncontrolled visibility snapshot after a rejected controlled proposal', () => {
    function Harness({ visibility }: { visibility?: Record<string, boolean> }) {
      const core = useGridCore()
      const columns = useGridColumns(core, {
        visibility,
        defaultVisibility: { age: false },
      })
      return (
        <button type="button" onClick={() => columns.toggleVisibility('age')}>
          {String(columns.state.visibility.age)}
        </button>
      )
    }

    const view = render(<Harness />)
    expect(view.getByRole('button').textContent).toBe('false')

    view.rerender(<Harness visibility={{ age: false }} />)
    fireEvent.click(view.getByRole('button'))
    expect(view.getByRole('button').textContent).toBe('false')

    view.rerender(<Harness />)
    expect(view.getByRole('button').textContent).toBe('false')

    view.rerender(<Harness visibility={{ age: true }} />)
    expect(view.getByRole('button').textContent).toBe('true')
    view.rerender(<Harness />)
    expect(view.getByRole('button').textContent).toBe('false')
    view.unmount()
  })

  it('restores the last uncontrolled width snapshot when controlled widths are removed', () => {
    function Harness({ widths }: { widths?: Record<string, number> }) {
      const core = useGridCore()
      const columns = useGridColumns(core, {
        widths,
        defaultWidths: { name: 100 },
      })
      return (
        <button type="button" onClick={() => columns.setWidth('name', 116)}>
          {String(columns.state.widths.name)}
        </button>
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button'))
    expect(view.getByRole('button').textContent).toBe('116')

    view.rerender(<Harness widths={{ name: 310 }} />)
    expect(view.getByRole('button').textContent).toBe('310')

    view.rerender(<Harness />)
    expect(view.getByRole('button').textContent).toBe('116')
    view.unmount()
  })

  it('restores default widths when an initially controlled width map is removed', () => {
    const onWidthsChange = vi.fn()
    function Harness({ widths }: { widths?: Record<string, number> }) {
      const core = useGridCore()
      const columns = useGridColumns(core, {
        widths,
        defaultWidths: { name: 220 },
        onWidthsChange,
      })
      return <button type="button">{String(columns.state.widths.name)}</button>
    }

    const view = render(<Harness widths={{ name: 310 }} />)
    expect(view.getByRole('button').textContent).toBe('310')

    view.rerender(<Harness />)
    expect(view.getByRole('button').textContent).toBe('220')
    expect(onWidthsChange).not.toHaveBeenCalled()
    view.unmount()
  })

  it('restores the last uncontrolled order snapshot when controlled order is removed', () => {
    function Harness({ order }: { order?: string[] }) {
      const core = useGridCore()
      const columns = useGridColumns(core, {
        order,
        defaultOrder: ['name', 'age'],
      })
      return (
        <button type="button" onClick={() => columns.setOrder(['age', 'name'])}>
          {columns.state.order.join(',')}
        </button>
      )
    }

    const view = render(<Harness />)
    expect(view.getByRole('button').textContent).toBe('name,age')

    view.rerender(<Harness order={['name', 'age']} />)
    fireEvent.click(view.getByRole('button'))
    expect(view.getByRole('button').textContent).toBe('name,age')

    view.rerender(<Harness />)
    expect(view.getByRole('button').textContent).toBe('name,age')
    view.unmount()
  })

  it('restores the last uncontrolled pinned snapshot when controlled pins are removed', () => {
    function Harness({ pinned }: { pinned?: Record<string, 'right' | null> }) {
      const core = useGridCore()
      const columns = useGridColumns(core, {
        pinned,
        defaultPinned: { name: 'left' },
      })
      return (
        <button type="button" onClick={() => columns.setPinned('name', null)}>
          {String(columns.state.pinned.name)}
        </button>
      )
    }

    const view = render(<Harness />)
    expect(view.getByRole('button').textContent).toBe('left')

    fireEvent.click(view.getByRole('button'))
    expect(view.getByRole('button').textContent).toBe('null')

    view.rerender(<Harness pinned={{ name: 'right' }} />)
    expect(view.getByRole('button').textContent).toBe('right')

    view.rerender(<Harness />)
    expect(view.getByRole('button').textContent).toBe('null')
    view.unmount()
  })

  it('keeps a controlled visibility state snapshot detached from a mutable map', () => {
    const visibility = { age: false }
    const snapshots: Record<string, boolean>[] = []
    function Harness() {
      const core = useGridCore()
      const columns = useGridColumns(core, { visibility })
      if (snapshots.length === 0) snapshots.push(columns.state.visibility)
      return <button type="button">{String(columns.state.visibility.age)}</button>
    }

    const view = render(<Harness />)
    expect(view.getByRole('button').textContent).toBe('false')

    visibility.age = true
    expect(snapshots[0]?.age).toBe(false)
    view.unmount()
  })

  it('isolates all column snapshots and restores each uncontrolled channel after handoff', () => {
    const captured = {
      visibility: { age: false },
      order: ['name'],
      widths: { name: 310 },
      pinned: { name: 'right' as const },
    }
    let columns!: ReturnType<typeof useGridColumns>
    function Harness({
      visibility,
      order,
      widths,
      pinned,
    }: {
      visibility?: Record<string, boolean>
      order?: string[]
      widths?: Record<string, number>
      pinned?: Record<string, 'left' | 'right' | null>
    }) {
      const core = useGridCore()
      columns = useGridColumns(core, {
        visibility,
        order,
        widths,
        pinned,
        defaultVisibility: { age: false },
        defaultOrder: ['name', 'age'],
        defaultWidths: { name: 100 },
        defaultPinned: { name: 'left' },
      })
      return (
        <>
          <output>{JSON.stringify(columns.state)}</output>
          <button
            type="button"
            onClick={() => {
              columns.setVisibility({ age: true })
              columns.setOrder(['age', 'name'])
              columns.setWidths({ name: 116 })
              columns.setPinned('name', null)
            }}
          >
            edit
          </button>
        </>
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button', { name: 'edit' }))
    expect(columns.model.get()).toMatchObject({
      visibility: { age: true },
      order: ['age', 'name'],
      widths: { name: 116 },
      pinned: { name: null },
    })

    view.rerender(<Harness {...captured} />)
    expect(columns.model.get()).toMatchObject(captured)

    columns.state.visibility.age = false
    columns.state.order.push('mutated')
    columns.state.widths.name = 999
    columns.state.pinned.name = 'left'
    expect(columns.model.get()).toMatchObject(captured)

    captured.visibility.age = true
    captured.order.push('mutated-input')
    captured.widths.name = 998
    captured.pinned.name = 'left'
    expect(columns.model.get()).toMatchObject({
      visibility: { age: false },
      order: ['name'],
      widths: { name: 310 },
      pinned: { name: 'right' },
    })

    view.rerender(<Harness />)
    expect(columns.state).toMatchObject({
      visibility: { age: true },
      order: ['age', 'name'],
      widths: { name: 116 },
      pinned: { name: null },
    })
    view.unmount()
  })
})
