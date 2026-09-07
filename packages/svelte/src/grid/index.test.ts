import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import { get } from 'svelte/store'
import type { GridCore } from '@iris-ui-kit/core/grid'
import GridBridgeHarness from './GridBridgeHarness.svelte'
import GridColumnsBridgeHarness from './GridColumnsBridgeHarness.svelte'
import { useGridColumns } from './useGrid'

describe('Svelte Grid Core bridge', () => {
  it('installs columns on the same core and keeps inbound sync silent', async () => {
    let core: GridCore<{ id: string }> | undefined
    const onVisibilityChange = vi.fn()
    const onWidthsChange = vi.fn()
    const view = render(GridColumnsBridgeHarness, {
      props: {
        onCore: (value) => (core = value),
        onVisibilityChange,
        onWidthsChange,
      },
    })

    expect(core).toBeDefined()
    expect(core!.features.filter((name) => name === 'columns')).toHaveLength(1)
    expect(
      view.container.querySelector('[data-model-identity]')?.getAttribute('data-model-identity'),
    ).toBe('true')

    await fireEvent.click(view.getByTestId('sync-visibility'))
    await fireEvent.click(view.getByTestId('sync-widths'))
    expect(onVisibilityChange).not.toHaveBeenCalled()
    expect(onWidthsChange).not.toHaveBeenCalled()

    await fireEvent.click(view.getByTestId('set-widths'))
    await fireEvent.click(view.getByTestId('set-visibility'))
    expect(onWidthsChange).toHaveBeenCalledWith({ name: 140 })
    expect(onVisibilityChange).toHaveBeenCalledWith({ hidden: true })

    await fireEvent.click(view.getByTestId('reset-widths'))
    expect(onWidthsChange).toHaveBeenLastCalledWith({})
    view.unmount()
    expect(core!.status).toBe('destroyed')
  })

  it('restores the uncontrolled visibility snapshot across rejected control handoff', async () => {
    const view = render(GridColumnsBridgeHarness, {
      props: { visibility: { hidden: false }, defaultVisibility: { hidden: false } },
    })
    const readVisibility = (): boolean | undefined =>
      JSON.parse(view.getByTestId('column-state').textContent ?? '{}').visibility?.hidden

    expect(readVisibility()).toBe(false)
    await fireEvent.click(view.getByTestId('toggle-visibility'))
    expect(readVisibility()).toBe(false)

    await view.rerender({ visibility: undefined })
    expect(readVisibility()).toBe(false)

    await view.rerender({ visibility: { hidden: true } })
    expect(readVisibility()).toBe(true)
    await view.rerender({ visibility: undefined })
    expect(readVisibility()).toBe(false)
    view.unmount()
  })

  it('isolates all column snapshots and restores each uncontrolled channel after handoff', async () => {
    let columns!: ReturnType<typeof useGridColumns>
    const controlled = {
      visibility: { hidden: false },
      order: ['name'],
      widths: { name: 310 },
      pinned: { name: 'right' as const },
    }
    const view = render(GridColumnsBridgeHarness, {
      props: {
        defaultVisibility: { hidden: false },
        defaultOrder: ['name', 'age'],
        defaultWidths: { name: 100 },
        defaultPinned: { name: 'left' },
        onColumns: (value) => (columns = value),
      },
    })

    await fireEvent.click(view.getByTestId('edit-columns'))
    expect(columns.model.get()).toMatchObject({
      visibility: { hidden: true },
      order: ['age', 'name'],
      widths: { name: 116 },
      pinned: { name: null },
    })

    await view.rerender(controlled)
    expect(columns.model.get()).toMatchObject(controlled)
    const snapshot = get(columns.state)
    snapshot.visibility.hidden = true
    snapshot.order.push('mutated')
    snapshot.widths.name = 999
    snapshot.pinned.name = 'left'
    expect(columns.model.get()).toMatchObject(controlled)

    controlled.visibility.hidden = true
    controlled.order.push('mutated-input')
    controlled.widths.name = 998
    controlled.pinned.name = 'left'
    expect(columns.model.get()).toMatchObject({
      visibility: { hidden: false },
      order: ['name'],
      widths: { name: 310 },
      pinned: { name: 'right' },
    })

    await view.rerender({
      visibility: undefined,
      order: undefined,
      widths: undefined,
      pinned: undefined,
    })
    expect(columns.model.get()).toMatchObject({
      visibility: { hidden: true },
      order: ['age', 'name'],
      widths: { name: 116 },
      pinned: { name: null },
    })
    view.unmount()
  })

  it('bridges the shared rows and selection stores into Svelte stores', async () => {
    const view = render(GridBridgeHarness)
    const selectionButton = view.getByRole('button', { name: '2:a:40' })
    expect(selectionButton.textContent).toContain('2:a:40')
    await selectionButton.click()
    expect(view.getByRole('button', { name: '2:a,b:40' }).textContent).toContain('2:a,b:40')
  })

  it('routes nested row mutations through tree accessors', async () => {
    const view = render(GridBridgeHarness)
    expect(view.getByTestId('tree-child').textContent).toBe('Child')
    await view.getByRole('button', { name: 'update nested' }).click()
    expect(view.getByTestId('tree-child').textContent).toBe('Updated')
    await view.getByRole('button', { name: 'remove nested' }).click()
    expect(view.getByTestId('tree-child').textContent).toBe('')
  })
})
