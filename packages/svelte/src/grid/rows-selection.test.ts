import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { get, type Readable } from 'svelte/store'
import { type GridCore, type SelectionModel } from '@iris-ui-kit/core/grid'
import GridBridgeHarness from './GridBridgeHarness.svelte'
import GridSelectionControlledHarness from './GridSelectionControlledHarness.svelte'

describe('Svelte Grid rows selection', () => {
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

  it('syncs accepted controlled selection props into the existing model silently', async () => {
    let core!: GridCore<{ id: string }>
    let model!: SelectionModel<string>
    let selection!: Readable<string[]>
    const onChange = vi.fn()
    const view = render(GridSelectionControlledHarness, {
      props: {
        value: ['a'],
        onChange,
        onCore: (value) => (core = value),
        onModel: (value) => (model = value),
        onSelection: (value) => (selection = value),
      },
    })
    await tick()

    expect(view.getByTestId('selection').textContent).toBe('["a"]')
    expect(get(selection)).toEqual(['a'])
    expect(model.get()).toEqual(['a'])
    const initialModel = model
    onChange.mockReset()

    await view.rerender({ value: ['b'] })
    await tick()

    expect(view.getByTestId('selection').textContent).toBe('["b"]')
    expect(get(selection)).toEqual(['b'])
    expect(model.get()).toEqual(['b'])
    expect(onChange).not.toHaveBeenCalled()
    expect(model).toBe(initialModel)
    expect(core.invoke<SelectionModel<string>>('getSelectionModel')).toBe(initialModel)
  })
})
