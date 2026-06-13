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

  describe('keyboard navigation (WAI-ARIA tree)', () => {
    const tree = (c: HTMLElement) => c.querySelector('[data-iris-tree]') as HTMLElement
    const item = (c: HTMLElement, id: string) =>
      c.querySelector(`[data-iris-tree-node="${id}"]`) as HTMLElement

    it('seeds roving tabindex on the first visible node', () => {
      const { container } = render(() => <IrisTree nodes={nodes} />)
      expect(item(container, 'a').getAttribute('tabindex')).toBe('0')
      expect(item(container, 'b').getAttribute('tabindex')).toBe('-1')
    })

    it('exposes aria-level reflecting depth', () => {
      const { container } = render(() => <IrisTree nodes={nodes} defaultExpandedIds={['a']} />)
      expect(item(container, 'a').getAttribute('aria-level')).toBe('1')
      expect(item(container, 'a1').getAttribute('aria-level')).toBe('2')
    })

    it('ArrowRight expands the active parent node', () => {
      const onExpand = vi.fn()
      const { container, queryByText } = render(() => (
        <IrisTree nodes={nodes} onExpand={onExpand} />
      ))
      expect(queryByText('Child A1')).toBeNull()
      fireEvent.keyDown(tree(container), { key: 'ArrowRight' })
      expect(item(container, 'a').getAttribute('aria-expanded')).toBe('true')
      expect(queryByText('Child A1')).not.toBeNull()
      expect(onExpand).toHaveBeenCalledWith(['a'])
    })

    it('ArrowDown / ArrowUp move roving focus through visible nodes', () => {
      const { container } = render(() => <IrisTree nodes={nodes} defaultExpandedIds={['a']} />)
      // visible order: a, a1, a2, b
      fireEvent.keyDown(tree(container), { key: 'ArrowDown' })
      expect(item(container, 'a1').getAttribute('tabindex')).toBe('0')
      expect(item(container, 'a').getAttribute('tabindex')).toBe('-1')
      fireEvent.keyDown(tree(container), { key: 'ArrowUp' })
      expect(item(container, 'a').getAttribute('tabindex')).toBe('0')
    })

    it('ArrowLeft collapses an expanded active node', () => {
      const { container, queryByText } = render(() => (
        <IrisTree nodes={nodes} defaultExpandedIds={['a']} />
      ))
      fireEvent.keyDown(tree(container), { key: 'ArrowLeft' })
      expect(item(container, 'a').getAttribute('aria-expanded')).toBe('false')
      expect(queryByText('Child A1')).toBeNull()
    })

    it('ArrowLeft from a leaf child moves focus to its parent', () => {
      const { container } = render(() => <IrisTree nodes={nodes} defaultExpandedIds={['a']} />)
      fireEvent.keyDown(tree(container), { key: 'ArrowDown' }) // active = a1 (leaf)
      expect(item(container, 'a1').getAttribute('tabindex')).toBe('0')
      fireEvent.keyDown(tree(container), { key: 'ArrowLeft' })
      expect(item(container, 'a').getAttribute('tabindex')).toBe('0')
    })

    it('Enter selects the active node', () => {
      const onSelect = vi.fn()
      const { container } = render(() => <IrisTree nodes={nodes} onSelect={onSelect} />)
      fireEvent.keyDown(tree(container), { key: 'Enter' })
      expect(onSelect).toHaveBeenCalledWith(['a'])
      expect(item(container, 'a').getAttribute('aria-selected')).toBe('true')
    })

    it('Home / End jump to the first / last visible node', () => {
      const { container } = render(() => <IrisTree nodes={nodes} defaultExpandedIds={['a']} />)
      fireEvent.keyDown(tree(container), { key: 'End' })
      expect(item(container, 'b').getAttribute('tabindex')).toBe('0') // last visible = b
      fireEvent.keyDown(tree(container), { key: 'Home' })
      expect(item(container, 'a').getAttribute('tabindex')).toBe('0')
    })
  })

  describe('checkable', () => {
    const checkboxFor = (container: HTMLElement, id: string) =>
      container.querySelector(
        `[data-iris-tree-node="${id}"] [data-iris-tree-checkbox]`,
      ) as HTMLInputElement | null

    it('renders a checkbox per node when checkable', () => {
      const { container } = render(() => (
        <IrisTree nodes={nodes} checkable defaultExpandedIds={['a']} />
      ))
      expect(checkboxFor(container, 'a')).toBeTruthy()
      expect(checkboxFor(container, 'a1')).toBeTruthy()
      expect(checkboxFor(container, 'b')).toBeTruthy()
    })

    it('checking a parent cascades to its (enabled) descendants and fires onCheckedChange', () => {
      const onCheckedChange = vi.fn()
      const { container } = render(() => (
        <IrisTree
          nodes={nodes}
          checkable
          defaultExpandedIds={['a']}
          onCheckedChange={onCheckedChange}
        />
      ))
      fireEvent.click(checkboxFor(container, 'a')!)
      expect(checkboxFor(container, 'a1')!.checked).toBe(true)
      expect(checkboxFor(container, 'a2')!.checked).toBe(true)
      expect(checkboxFor(container, 'a')!.checked).toBe(true)
      expect(onCheckedChange).toHaveBeenCalled()
      expect(onCheckedChange.mock.calls.at(-1)![0]).toContain('a1')
    })

    it('a partially-checked parent is aria-checked=mixed and indeterminate', () => {
      const { container } = render(() => (
        <IrisTree nodes={nodes} checkable defaultExpandedIds={['a']} defaultChecked={['a1']} />
      ))
      // 'a' has only some descendants checked → indeterminate (aria mixed)
      const parent = checkboxFor(container, 'a')!
      expect(parent.getAttribute('aria-checked')).toBe('mixed')
      expect(parent.indeterminate).toBe(true)
      expect(parent.checked).toBe(false)
    })

    it('no checkboxes when checkable is off', () => {
      const { container } = render(() => <IrisTree nodes={nodes} defaultExpandedIds={['a']} />)
      expect(checkboxFor(container, 'a')).toBeNull()
      expect(checkboxFor(container, 'a1')).toBeNull()
    })
  })
})
