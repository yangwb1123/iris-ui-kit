import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect } from 'vitest'
import IrisTreeSelect from './IrisTreeSelect.svelte'

const nodes = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta', children: [{ id: 'b1', label: 'Beta 1' }] },
]

describe('IrisTreeSelect', () => {
  it('renders trigger button', () => {
    const { container } = render(IrisTreeSelect, { props: { nodes } })
    expect(container.querySelector('[data-iris-tree-select-trigger]')).toBeTruthy()
  })

  it('opens panel on trigger click', async () => {
    const { container } = render(IrisTreeSelect, { props: { nodes } })
    const trigger = container.querySelector('[data-iris-tree-select-trigger]')!
    await fireEvent.click(trigger)
    flushSync()
    expect(container.querySelector('[data-iris-tree-select-panel]')).toBeTruthy()
    expect(container.querySelector('[data-iris-tree]')).toBeTruthy()
  })
})
