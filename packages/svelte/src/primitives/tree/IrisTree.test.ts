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

  describe('keyboard navigation (WAI-ARIA tree)', () => {
    const items = (c: HTMLElement) =>
      Array.from(c.querySelectorAll('[data-iris-tree-item]')) as HTMLElement[]

    it('exposes aria-level reflecting depth', () => {
      const { container } = render(IrisTree, { props: { nodes, defaultExpanded: ['1'] } })
      const list = items(container) // visible: Root A, Child A1, Child A2, Root B
      expect(list[0].getAttribute('aria-level')).toBe('1')
      expect(list[1].getAttribute('aria-level')).toBe('2')
    })

    it('ArrowDown moves roving focus to the next visible node', async () => {
      const { container } = render(IrisTree, { props: { nodes, defaultExpanded: ['1'] } })
      await fireEvent.keyDown(items(container)[0], { key: 'ArrowDown' })
      flushSync()
      const list = items(container)
      expect(list[1].getAttribute('tabindex')).toBe('0')
      expect(list[0].getAttribute('tabindex')).toBe('-1')
    })

    it('Home / End jump to the first / last visible node', async () => {
      const { container } = render(IrisTree, { props: { nodes, defaultExpanded: ['1'] } })
      await fireEvent.keyDown(items(container)[0], { key: 'End' })
      flushSync()
      expect(items(container)[3].getAttribute('tabindex')).toBe('0') // last visible = Root B
      await fireEvent.keyDown(items(container)[0], { key: 'Home' })
      flushSync()
      expect(items(container)[0].getAttribute('tabindex')).toBe('0')
    })

    it('Enter selects the active node', async () => {
      const { container } = render(IrisTree, { props: { nodes, defaultExpanded: ['1'] } })
      await fireEvent.keyDown(items(container)[0], { key: 'Enter' })
      flushSync()
      expect(items(container)[0].getAttribute('aria-selected')).toBe('true')
    })
  })

  describe('checkable', () => {
    const checkNodes = [
      {
        id: 'root',
        label: 'Root',
        children: [
          { id: 'a', label: 'A', children: [{ id: 'a1', label: 'A1' }] },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C', disabled: true },
        ],
      },
      { id: 'standalone', label: 'Standalone' },
    ]

    const checkboxFor = (container: HTMLElement, label: string) =>
      container.querySelector(
        `[data-iris-tree-checkbox][aria-label="${label}"]`,
      ) as HTMLInputElement | null

    it('renders a checkbox per node when checkable', () => {
      const { container } = render(IrisTree, {
        props: { nodes: checkNodes, checkable: true, expanded: ['root', 'a'] },
      })
      expect(checkboxFor(container, 'Root')).toBeTruthy()
      expect(checkboxFor(container, 'A1')).toBeTruthy()
    })

    it('checking a parent cascades to its (enabled) descendants and fires onCheckedChange', async () => {
      const calls: string[][] = []
      const { container } = render(IrisTree, {
        props: {
          nodes: checkNodes,
          checkable: true,
          expanded: ['root', 'a'],
          onCheckedChange: (checked: string[]) => calls.push(checked),
        },
      })
      await fireEvent.click(checkboxFor(container, 'A')!)
      flushSync()
      expect(checkboxFor(container, 'A1')!.checked).toBe(true)
      expect(checkboxFor(container, 'A')!.checked).toBe(true)
      expect(calls.length).toBeGreaterThan(0)
      expect(calls.at(-1)!).toContain('a1')
    })

    it('a partially-checked parent is indeterminate (aria mixed)', () => {
      const { container } = render(IrisTree, {
        props: {
          nodes: checkNodes,
          checkable: true,
          expanded: ['root', 'a'],
          defaultChecked: ['a1'],
        },
      })
      // root has only some descendants checked → indeterminate (aria mixed)
      const root = checkboxFor(container, 'Root')!
      expect(root.getAttribute('aria-checked')).toBe('mixed')
      expect(root.indeterminate).toBe(true)
    })

    it('no checkboxes when checkable is off', () => {
      const { container } = render(IrisTree, {
        props: { nodes: checkNodes, expanded: ['root'] },
      })
      expect(checkboxFor(container, 'Root')).toBeNull()
    })
  })
})
