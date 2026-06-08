import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect } from 'vitest'
import IrisTree from './IrisTree.svelte'

const nodes = [
  {
    id: '1',
    label: 'Root A',
    children: [
      { id: '1-1', label: 'Child A1' },
      { id: '1-2', label: 'Child A2' },
    ],
  },
  { id: '2', label: 'Root B' },
]

describe('IrisTree', () => {
  it('renders root nodes', () => {
    const { container } = render(IrisTree, { props: { nodes } })
    expect(container.querySelector('[data-iris-tree]')).toBeTruthy()
    const items = container.querySelectorAll('[data-iris-tree-item]')
    expect(items.length).toBe(2)
  })

  it('expands node on arrow click', async () => {
    const { container } = render(IrisTree, { props: { nodes } })
    const expandBtn = container.querySelector('[data-iris-tree-item] button')!
    await fireEvent.click(expandBtn)
    flushSync()
    const items = container.querySelectorAll('[data-iris-tree-item]')
    expect(items.length).toBe(4) // 2 roots + 2 children
  })

  it('shows empty state', () => {
    const { container } = render(IrisTree, { props: { nodes: [] } })
    expect(container.querySelector('[data-iris-state="empty"]')).toBeTruthy()
  })

  it('shows loading state', () => {
    const { container } = render(IrisTree, { props: { nodes: [], loading: true } })
    expect(container.querySelector('[data-iris-state="loading"]')).toBeTruthy()
  })
})
