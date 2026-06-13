import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisTreeSelect } from './IrisTreeSelect'

afterEach(cleanup)

const nodes = [
  { id: 'a', label: 'Option A', isLeaf: true },
  { id: 'b', label: 'Option B', children: [{ id: 'b1', label: 'Sub B1', isLeaf: true }] },
]

describe('IrisTreeSelect', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisTreeSelect nodes={nodes} />)
    expect(container.querySelector('[data-iris-tree-select]')).not.toBeNull()
  })

  it('shows placeholder initially', () => {
    const { getByText } = render(() => <IrisTreeSelect nodes={nodes} placeholder="Choose…" />)
    expect(getByText('Choose…')).not.toBeNull()
  })

  it('opens panel on click', () => {
    const { container } = render(() => <IrisTreeSelect nodes={nodes} />)
    expect(container.querySelector('[data-iris-tree-select-panel]')).toBeNull()
    const btn = container.querySelector('[data-iris-tree-select-trigger]') as HTMLButtonElement
    fireEvent.click(btn)
    expect(container.querySelector('[data-iris-tree-select-panel]')).not.toBeNull()
  })

  it('ArrowDown on the closed trigger opens the panel; Escape closes it', () => {
    const { container } = render(() => <IrisTreeSelect nodes={nodes} />)
    const btn = container.querySelector('[data-iris-tree-select-trigger]') as HTMLButtonElement
    fireEvent.keyDown(btn, { key: 'ArrowDown' })
    expect(container.querySelector('[data-iris-tree-select-panel]')).not.toBeNull()
    fireEvent.keyDown(btn, { key: 'Escape' })
    expect(container.querySelector('[data-iris-tree-select-panel]')).toBeNull()
  })

  it('closes the panel on outside click', () => {
    const { container } = render(() => <IrisTreeSelect nodes={nodes} />)
    const btn = container.querySelector('[data-iris-tree-select-trigger]') as HTMLButtonElement
    fireEvent.click(btn)
    expect(container.querySelector('[data-iris-tree-select-panel]')).not.toBeNull()
    fireEvent.mouseDown(document.body)
    expect(container.querySelector('[data-iris-tree-select-panel]')).toBeNull()
  })
})
