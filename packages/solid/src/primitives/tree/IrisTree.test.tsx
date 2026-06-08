import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisTree } from './IrisTree'

afterEach(cleanup)

const nodes = [
  {
    id: 'a',
    label: 'Node A',
    children: [
      { id: 'a1', label: 'Child A1' },
      { id: 'a2', label: 'Child A2' },
    ],
  },
  { id: 'b', label: 'Node B', isLeaf: true },
]

describe('IrisTree', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisTree nodes={nodes} />)
    expect(container.querySelector('[data-iris-tree]')).not.toBeNull()
  })

  it('renders top level nodes', () => {
    const { getByText } = render(() => <IrisTree nodes={nodes} />)
    expect(getByText('Node A')).not.toBeNull()
    expect(getByText('Node B')).not.toBeNull()
  })

  it('expands node on click', () => {
    const { container, getByText } = render(() => <IrisTree nodes={nodes} />)
    // Children not visible until expanded
    const nodeA = container.querySelector('[data-iris-tree-node="a"]') as HTMLElement
    const row = nodeA.querySelector('[data-iris-tree-node-row]') as HTMLElement
    fireEvent.click(row)
    expect(getByText('Child A1')).not.toBeNull()
  })

  it('calls onSelect when node is clicked', () => {
    const onSelect = vi.fn()
    const { container } = render(() => <IrisTree nodes={nodes} onSelect={onSelect} />)
    const bRow = container.querySelector(
      '[data-iris-tree-node="b"] [data-iris-tree-node-row]',
    ) as HTMLElement
    fireEvent.click(bRow)
    expect(onSelect).toHaveBeenCalledWith(['b'])
  })
})
