import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import type { GridCore } from '@iris-ui-kit/core/grid'
import GridBridgeHarness from './GridBridgeHarness.svelte'
import GridColumnsBridgeHarness from './GridColumnsBridgeHarness.svelte'

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
