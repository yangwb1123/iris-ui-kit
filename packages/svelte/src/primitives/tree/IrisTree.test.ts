import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import { waitFor } from '@testing-library/svelte'
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

  it('clears lazy loading on rejection and remains retryable', async () => {
    const loadChildren = vi
      .fn<() => Promise<{ id: string; label: string }>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([{ id: 'child', label: 'Child' }])
    const lazyNodes = [{ id: 'lazy', label: 'Lazy', loadChildren }]
    const { container } = render(IrisTree, { props: { nodes: lazyNodes } })
    const toggle = () => container.querySelector('[data-iris-tree-item] button') as HTMLElement

    await fireEvent.click(toggle())
    await waitFor(() => {
      const item = container.querySelector('[data-iris-tree-item]')!
      expect(item.getAttribute('data-loading')).toBeNull()
      expect(item.getAttribute('data-error')).toBe('')
      expect(item.getAttribute('aria-expanded')).toBe('false')
    })

    await fireEvent.click(toggle())
    await waitFor(() => expect(container.textContent).toContain('Child'))
    expect(loadChildren).toHaveBeenCalledTimes(2)
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

    it('does not reseed uncontrolled checks from a fresh defaultChecked prop', async () => {
      const view = render(IrisTree, {
        props: {
          nodes: checkNodes,
          checkable: true,
          expanded: ['root', 'a'],
          defaultChecked: [],
        },
      })
      await fireEvent.click(checkboxFor(view.container, 'A')!)
      flushSync()
      await view.rerender({ defaultChecked: [] })
      flushSync()
      expect(checkboxFor(view.container, 'A')!.checked).toBe(true)
      expect(checkboxFor(view.container, 'A1')!.checked).toBe(true)
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

    it('cascades to lazy children when eager children is an empty placeholder', async () => {
      const lazy = [
        {
          id: 'root',
          label: 'Root',
          children: [],
          loadChildren: async () => [{ id: 'child', label: 'Child' }],
        },
      ]
      const { container } = render(IrisTree, { props: { nodes: lazy, checkable: true } })
      await fireEvent.click(container.querySelector('[data-iris-tree-item] button')!)
      await waitFor(() => expect(container.textContent).toContain('Child'))
      await fireEvent.click(
        container.querySelector('[data-iris-tree-checkbox][aria-label="Root"]')!,
      )
      flushSync()
      expect(
        (
          container.querySelector(
            '[data-iris-tree-checkbox][aria-label="Child"]',
          ) as HTMLInputElement
        ).checked,
      ).toBe(true)
    })
  })
})
