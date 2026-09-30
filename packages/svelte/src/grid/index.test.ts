import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import type { GridCore } from '@iris-ui-kit/core/grid'
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
})
