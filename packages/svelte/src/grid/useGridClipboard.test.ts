import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import type { GridClipboardModel, GridCore } from '@iris-ui-kit/core/grid'
import GridClipboardHarness from './GridClipboardHarness.svelte'

describe('useGridClipboard', () => {
  it('shares the feature-owned model and routes paste through the rows bridge', async () => {
    let core: GridCore<{ id: number; name: string }> | undefined
    let model: GridClipboardModel | undefined
    const view = render(GridClipboardHarness, {
      capture: (nextCore, nextModel) => {
        core = nextCore
        model = nextModel
      },
    })

    const selectButton = view.getByRole('button', { name: 'null' })
    expect(core?.hasFeature('clipboard')).toBe(true)
    expect(core?.invoke('getClipboardModel')).toBe(model)
    expect(selectButton.dataset.clipboard).toBe('true')

    await selectButton.click()
    expect(selectButton.textContent?.trim()).toBe('Ada')
    await view.getByRole('button', { name: 'paste' }).click()
    expect(view.getByTestId('row').textContent).toBe('Grace')
    view.unmount()
  })
})
