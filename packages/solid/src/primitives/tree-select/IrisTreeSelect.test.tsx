import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisTreeSelect } from './IrisTreeSelect'

afterEach(cleanup)

const nodes = [
  { id: 'a', label: 'Option A', isLeaf: true },
  {
    id: 'b',
    label: 'Option B',
    children: [
      { id: 'b1', label: 'Sub B1', isLeaf: true },
      { id: 'b2', label: 'Sub B2', isLeaf: true },
    ],
  },
  { id: 'c', label: 'Option C', isLeaf: true },
]

function triggerEl(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-tree-select-trigger]') as HTMLElement
}
function panelEl(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-iris-tree-select-panel]')
}
function treeNodes(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-iris-tree-node]'))
}
function nodeRow(container: HTMLElement, id: string): HTMLElement | null {
  const node = container.querySelector(`[data-iris-tree-node="${id}"]`)
  if (!node) return null
  return node.querySelector('[data-iris-tree-node-row]')
}

describe('IrisTreeSelect', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisTreeSelect nodes={nodes} />)
    expect(container.querySelector('[data-iris-tree-select]')).not.toBeNull()
  })

  it('shows placeholder initially', () => {
    const { getByText } = render(() => <IrisTreeSelect nodes={nodes} placeholder="Choose…" />)
    expect(getByText('Choose…')).not.toBeNull()
  })

  it('opens panel on trigger click', () => {
    const { container } = render(() => <IrisTreeSelect nodes={nodes} />)
    expect(panelEl(container)).toBeNull()
    fireEvent.click(triggerEl(container))
    expect(panelEl(container)).not.toBeNull()
  })

  it('shows tree nodes inside the panel', () => {
    const { container } = render(() => <IrisTreeSelect nodes={nodes} />)
    fireEvent.click(triggerEl(container))
    // Root nodes visible
    const items = treeNodes(container)
    expect(items.length).toBeGreaterThanOrEqual(3)
  })

  it('ArrowDown on closed trigger opens the panel; Escape closes it', () => {
    const { container } = render(() => <IrisTreeSelect nodes={nodes} />)
    const btn = triggerEl(container)
    fireEvent.keyDown(btn, { key: 'ArrowDown' })
    expect(panelEl(container)).not.toBeNull()
    fireEvent.keyDown(btn, { key: 'Escape' })
    expect(panelEl(container)).toBeNull()
  })

  it('closes the panel on outside click', () => {
    const { container } = render(() => <IrisTreeSelect nodes={nodes} />)
    fireEvent.click(triggerEl(container))
    expect(panelEl(container)).not.toBeNull()
    fireEvent.mouseDown(document.body)
    expect(panelEl(container)).toBeNull()
  })

  it('has aria-expanded on the trigger', () => {
    const { container } = render(() => <IrisTreeSelect nodes={nodes} />)
    const btn = triggerEl(container)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  it('disables the trigger when disabled', () => {
    const { container } = render(() => <IrisTreeSelect nodes={nodes} disabled />)
    const btn = triggerEl(container)
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('applies aria-invalid when invalid', () => {
    const { container } = render(() => <IrisTreeSelect nodes={nodes} invalid />)
    const btn = triggerEl(container)
    expect(btn.getAttribute('aria-invalid')).toBe('true')
  })

  it('displays the selected node label in controlled mode', () => {
    const { container } = render(() => <IrisTreeSelect nodes={nodes} value={['b1']} />)
    // The trigger should show "Sub B1"
    const btn = triggerEl(container)
    expect(btn.textContent).toContain('Sub B1')
  })

  it('displays multiple selected labels in multi mode', () => {
    const { container } = render(() => (
      <IrisTreeSelect nodes={nodes} value={['a', 'c']} selectionMode="multi" />
    ))
    const btn = triggerEl(container)
    expect(btn.textContent).toContain('Option A')
    expect(btn.textContent).toContain('Option C')
  })

  it('calls onChange when a leaf is selected', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisTreeSelect nodes={nodes} onChange={onChange} />)
    fireEvent.click(triggerEl(container))
    // Click the row of leaf node "a"
    const row = nodeRow(container, 'a')
    expect(row).not.toBeNull()
    if (row) fireEvent.click(row)
    expect(onChange).toHaveBeenCalled()
  })

  it('expands parent nodes to show children', () => {
    const { container } = render(() => <IrisTreeSelect nodes={nodes} selectionMode="multi" />)
    fireEvent.click(triggerEl(container))
    // Initially children not visible
    const subB1 = container.querySelector('[data-iris-tree-node="b1"]')
    expect(subB1).toBeNull()

    // Click the row of parent node "b" to toggle expansion
    const parentRow = nodeRow(container, 'b')
    expect(parentRow).not.toBeNull()
    if (parentRow) {
      fireEvent.click(parentRow)
      // Children should now be visible (multi mode keeps panel open)
      const b1 = container.querySelector('[data-iris-tree-node="b1"]')
      expect(b1).not.toBeNull()
      expect(b1?.textContent).toContain('Sub B1')
    }
  })

  it('handles empty nodes gracefully', () => {
    const { container } = render(() => <IrisTreeSelect nodes={[]} />)
    fireEvent.click(triggerEl(container))
    // Panel opens but shows no nodes
    expect(panelEl(container)).not.toBeNull()
  })
})
