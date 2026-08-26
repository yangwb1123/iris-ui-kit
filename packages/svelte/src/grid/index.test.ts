import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import GridBridgeHarness from './GridBridgeHarness.svelte'

describe('Svelte Grid Core bridge', () => {
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
