import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTree } from './Tree'
import type { IrisTreeNode } from './types'

afterEach(() => cleanup())

const nodes: IrisTreeNode[] = [
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

function items(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[role=treeitem]'))
}

describe('@iris-ui-kit/react IrisTree', () => {
  it('renders root nodes only by default', () => {
    render(<IrisTree nodes={nodes} />)
    const ids = items().map((el) => el.getAttribute('data-iris-tree-node'))
    expect(ids).toEqual(['root', 'standalone'])
  })

  it('expanding a node renders its children', () => {
    render(<IrisTree nodes={nodes} defaultExpanded={['root']} />)
    const ids = items().map((el) => el.getAttribute('data-iris-tree-node'))
    expect(ids).toEqual(['root', 'a', 'b', 'c', 'standalone'])
  })

  it('aria-expanded reflects state on parent nodes', () => {
    render(<IrisTree nodes={nodes} defaultExpanded={['root']} />)
    const root = document.querySelector('[data-iris-tree-node=root]')!
    expect(root.getAttribute('aria-expanded')).toBe('true')
  })

  it('aria-level reflects depth', () => {
    render(<IrisTree nodes={nodes} defaultExpanded={['root', 'a']} />)
    const a1 = document.querySelector('[data-iris-tree-node=a1]')!
    expect(a1.getAttribute('aria-level')).toBe('3')
  })

  it('toggle button expands and collapses', () => {
    const onExp = vi.fn()
    render(<IrisTree nodes={nodes} onExpandedChange={onExp} />)
    const toggle = document.querySelector(
      '[data-iris-tree-node=root] [data-iris-tree-toggle]',
    ) as HTMLButtonElement
    act(() => {
      fireEvent.click(toggle)
    })
    expect(onExp).toHaveBeenLastCalledWith(['root'])
  })

  it('clicking a node selects it (single mode)', () => {
    const onSel = vi.fn()
    render(<IrisTree nodes={nodes} defaultExpanded={['root']} onSelectedChange={onSel} />)
    act(() => {
      fireEvent.click(document.querySelector('[data-iris-tree-node=b]')!)
    })
    expect(onSel).toHaveBeenLastCalledWith(['b'])
  })

  it('multi mode toggles selection', () => {
    const onSel = vi.fn()
    render(
      <IrisTree
        nodes={nodes}
        defaultExpanded={['root']}
        selectionMode="multi"
        onSelectedChange={onSel}
      />,
    )
    act(() => {
      fireEvent.click(document.querySelector('[data-iris-tree-node=a]')!)
    })
    expect(onSel).toHaveBeenLastCalledWith(['a'])
    act(() => {
      fireEvent.click(document.querySelector('[data-iris-tree-node=b]')!)
    })
    expect(onSel).toHaveBeenLastCalledWith(['a', 'b'])
    act(() => {
      fireEvent.click(document.querySelector('[data-iris-tree-node=a]')!)
    })
    expect(onSel).toHaveBeenLastCalledWith(['b'])
  })

  it('disabled node is not selectable', () => {
    const onSel = vi.fn()
    render(<IrisTree nodes={nodes} defaultExpanded={['root']} onSelectedChange={onSel} />)
    act(() => {
      fireEvent.click(document.querySelector('[data-iris-tree-node=c]')!)
    })
    expect(onSel).not.toHaveBeenCalled()
  })

  it('selectionMode=none disables selection entirely', () => {
    const onSel = vi.fn()
    render(
      <IrisTree
        nodes={nodes}
        defaultExpanded={['root']}
        selectionMode="none"
        onSelectedChange={onSel}
      />,
    )
    act(() => {
      fireEvent.click(document.querySelector('[data-iris-tree-node=a]')!)
    })
    expect(onSel).not.toHaveBeenCalled()
  })

  it('ArrowDown moves active node forward', () => {
    render(<IrisTree nodes={nodes} defaultExpanded={['root']} />)
    const tree = document.querySelector('[role=tree]')!
    act(() => {
      fireEvent.keyDown(tree, { key: 'ArrowDown' })
    })
    expect(document.querySelector('[data-state=active]')?.getAttribute('data-iris-tree-node')).toBe(
      'a',
    )
  })

  it('ArrowRight expands a closed parent then drills into first child', () => {
    const onExp = vi.fn()
    render(<IrisTree nodes={nodes} onExpandedChange={onExp} />)
    const tree = document.querySelector('[role=tree]')!
    // Root is active by default; arrow-right expands.
    act(() => {
      fireEvent.keyDown(tree, { key: 'ArrowRight' })
    })
    expect(onExp).toHaveBeenLastCalledWith(['root'])
  })

  it('ArrowLeft collapses an expanded parent', () => {
    const onExp = vi.fn()
    render(<IrisTree nodes={nodes} defaultExpanded={['root']} onExpandedChange={onExp} />)
    const tree = document.querySelector('[role=tree]')!
    act(() => {
      fireEvent.keyDown(tree, { key: 'ArrowLeft' })
    })
    expect(onExp).toHaveBeenLastCalledWith([])
  })

  it('Enter selects active node', () => {
    const onSel = vi.fn()
    render(<IrisTree nodes={nodes} defaultExpanded={['root']} onSelectedChange={onSel} />)
    const tree = document.querySelector('[role=tree]')!
    act(() => {
      fireEvent.keyDown(tree, { key: 'ArrowDown' }) // active = a
    })
    act(() => {
      fireEvent.keyDown(tree, { key: 'Enter' })
    })
    expect(onSel).toHaveBeenLastCalledWith(['a'])
  })

  it('Home / End jump to first / last visible', () => {
    render(<IrisTree nodes={nodes} defaultExpanded={['root']} />)
    const tree = document.querySelector('[role=tree]')!
    act(() => {
      fireEvent.keyDown(tree, { key: 'End' })
    })
    expect(document.querySelector('[data-state=active]')?.getAttribute('data-iris-tree-node')).toBe(
      'standalone',
    )
    act(() => {
      fireEvent.keyDown(tree, { key: 'Home' })
    })
    expect(document.querySelector('[data-state=active]')?.getAttribute('data-iris-tree-node')).toBe(
      'root',
    )
  })

  it('controlled expanded reflects on UI', () => {
    const { rerender } = render(<IrisTree nodes={nodes} expanded={[]} />)
    expect(items().length).toBe(2)
    rerender(<IrisTree nodes={nodes} expanded={['root']} />)
    expect(items().length).toBe(5)
  })

  it('controlled selected highlights right node', () => {
    render(<IrisTree nodes={nodes} defaultExpanded={['root']} selected={['b']} />)
    expect(document.querySelector('[data-iris-tree-node=b]')?.getAttribute('aria-selected')).toBe(
      'true',
    )
  })

  it('leaf nodes have no toggle button', () => {
    render(<IrisTree nodes={nodes} defaultExpanded={['root']} />)
    const b = document.querySelector('[data-iris-tree-node=b]')!
    expect(b.querySelector('[data-iris-tree-toggle]')).toBeNull()
  })
})

describe('@iris-ui-kit/react IrisTree lazy loading', () => {
  it('shows an expand affordance for a loader-backed node with no eager children', () => {
    const lazy: IrisTreeNode[] = [
      { id: 'root', label: 'Root', loadChildren: vi.fn(async () => []) },
    ]
    render(<IrisTree nodes={lazy} />)
    const root = document.querySelector('[data-iris-tree-node=root]')!
    expect(root.querySelector('[data-iris-tree-toggle]')).not.toBeNull()
    expect(root.getAttribute('aria-expanded')).toBe('false')
  })

  it('lazily loads and caches children on expand (no second load on re-expand)', async () => {
    const loadChildren = vi.fn(async () => [{ id: 'c1', label: 'Child 1' }])
    const lazy: IrisTreeNode[] = [{ id: 'root', label: 'Root', loadChildren }]
    render(<IrisTree nodes={lazy} />)
    const toggle = () => document.querySelector('[data-iris-tree-toggle]') as HTMLElement
    await act(async () => {
      fireEvent.click(toggle())
    })
    expect(loadChildren).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-iris-tree-node=c1]')).not.toBeNull()
    // Collapse, then re-expand → served from cache, loader not called again.
    await act(async () => {
      fireEvent.click(toggle())
    })
    await act(async () => {
      fireEvent.click(toggle())
    })
    expect(loadChildren).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-iris-tree-node=c1]')).not.toBeNull()
  })

  it('marks the node errored and collapses when the loader rejects', async () => {
    const loadChildren = vi.fn(async (): Promise<IrisTreeNode[]> => {
      throw new Error('boom')
    })
    const lazy: IrisTreeNode[] = [{ id: 'root', label: 'Root', loadChildren }]
    render(<IrisTree nodes={lazy} />)
    await act(async () => {
      fireEvent.click(document.querySelector('[data-iris-tree-toggle]') as HTMLElement)
    })
    const root = document.querySelector('[data-iris-tree-node=root]')!
    expect(root.getAttribute('data-error')).toBe('')
    expect(root.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('@iris-ui-kit/react IrisTree RTL', () => {
  it('indents with logical inline-start padding (RTL-safe)', () => {
    render(<IrisTree nodes={nodes} />)
    const root = document.querySelector('[data-iris-tree-node=root]') as HTMLElement
    expect(root.style.paddingInlineStart).toBeTruthy()
    expect(root.style.paddingLeft).toBe('')
  })
})

describe('@iris-ui-kit/react IrisTree data states', () => {
  it('shows the empty state (localized) when nodes is empty', () => {
    render(<IrisTree nodes={[]} />)
    const node = document.querySelector('[data-iris-tree-state]')!
    expect(node.getAttribute('data-iris-tree-state')).toBe('empty')
    expect(node.textContent).toBe('No items to display')
  })

  it('shows loading with aria-busy; error takes precedence', () => {
    const { rerender } = render(<IrisTree nodes={[]} loading />)
    expect(
      document.querySelector('[data-iris-tree-state]')?.getAttribute('data-iris-tree-state'),
    ).toBe('loading')
    expect(document.querySelector('[role=tree]')?.getAttribute('aria-busy')).toBe('true')
    rerender(<IrisTree nodes={[]} loading error />)
    expect(
      document.querySelector('[data-iris-tree-state]')?.getAttribute('data-iris-tree-state'),
    ).toBe('error')
  })

  it('renders nodes (no state node) when content is present', () => {
    render(<IrisTree nodes={nodes} />)
    expect(document.querySelector('[data-iris-tree-state]')).toBeNull()
  })

  describe('checkable', () => {
    const checkboxFor = (id: string) =>
      document.querySelector(
        `[data-iris-tree-node="${id}"] [data-iris-tree-checkbox]`,
      ) as HTMLInputElement | null

    it('renders a checkbox per node when checkable', () => {
      render(<IrisTree nodes={nodes} checkable expanded={['root', 'a']} />)
      expect(checkboxFor('root')).toBeTruthy()
      expect(checkboxFor('a1')).toBeTruthy()
    })

    it('checking a parent cascades to its (enabled) descendants and fires onCheckedChange', () => {
      const onCheckedChange = vi.fn()
      render(
        <IrisTree
          nodes={nodes}
          checkable
          expanded={['root', 'a']}
          onCheckedChange={onCheckedChange}
        />,
      )
      act(() => {
        fireEvent.click(checkboxFor('a')!)
      })
      expect(checkboxFor('a1')!.checked).toBe(true)
      expect(checkboxFor('a')!.checked).toBe(true)
      expect(onCheckedChange).toHaveBeenCalled()
      expect(onCheckedChange.mock.calls.at(-1)![0]).toContain('a1')
    })

    it('a partially-checked parent is indeterminate', () => {
      render(<IrisTree nodes={nodes} checkable expanded={['root', 'a']} defaultChecked={['a1']} />)
      // root has only some descendants checked → indeterminate (aria mixed)
      expect(checkboxFor('root')!.getAttribute('aria-checked')).toBe('mixed')
    })

    it('no checkboxes when checkable is off', () => {
      render(<IrisTree nodes={nodes} expanded={['root']} />)
      expect(checkboxFor('root')).toBeNull()
    })
  })
})

describe('@iris-ui-kit/react IrisTree virtual', () => {
  const virtual = { itemHeight: 28, height: 400, buffer: 4 }
  const many = (count: number): IrisTreeNode[] =>
    Array.from({ length: count }, (_, i) => ({ id: String(i), label: `Node ${i}` }))

  const flushRaf = async (): Promise<void> => {
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
  }
  // Double flush: frame 1 runs the virtualizer's scroll rAF (window re-render)
  // and the focus-follows re-check; frame 2 finds the freshly mounted row.
  const flushVirtual = async (): Promise<void> => {
    await flushRaf()
    await flushRaf()
  }

  const virtualRoot = (): HTMLDivElement =>
    document.querySelector('[data-iris-virtual-scroll]') as HTMLDivElement
  const renderedIndices = (): number[] =>
    Array.from(document.querySelectorAll('[data-iris-virtual-index]')).map((el) =>
      Number(el.getAttribute('data-iris-virtual-index')),
    )

  it('A1: windowed render keeps the DOM bounded (5,000 nodes)', () => {
    render(<IrisTree nodes={many(5000)} virtual={virtual} />)
    const rows = items()
    // jsdom reports clientHeight 0, so the viewport collapses and the window
    // is buffer-only [0, 4) at scrollTop 0 — assert bounds, never the exact
    // 23 rows of a real viewport (documented in VirtualScroll.test.tsx).
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThanOrEqual(23)
    expect(document.querySelectorAll('[data-iris-virtual-item]').length).toBe(rows.length)
    for (const row of rows) {
      expect(row.closest('[data-iris-virtual-item]')).not.toBeNull()
    }
    const idxs = renderedIndices()
    expect(idxs.length).toBe(rows.length)
    expect(Math.min(...idxs)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...idxs)).toBeLessThan(23)
    // Full content height preserved via the spacer (5000 × 28).
    const spacer = document.querySelector('[data-iris-virtual-spacer]') as HTMLElement
    expect(spacer.style.height).toBe('140000px')
    // The scroll root IS the tree root: role/overflow/height + tree attrs.
    const root = virtualRoot()
    expect(root.style.overflow).toBe('auto')
    expect(root.style.height).toBe('400px')
    expect(root.getAttribute('role')).toBe('tree')
    expect(root.getAttribute('data-iris-tree')).toBe('')
    expect(root.getAttribute('aria-label')).toBeTruthy()
    // Control: the same tree without `virtual` renders every row.
    cleanup()
    render(<IrisTree nodes={many(5000)} />)
    expect(items().length).toBe(5000)
    expect(document.querySelector('[data-iris-virtual-scroll]')).toBeNull()
  }, 15_000)

  it("A2: default off renders today's DOM (no virtual nodes)", () => {
    const { rerender } = render(<IrisTree nodes={nodes} />)
    expect(document.querySelector('[data-iris-tree]')).not.toBeNull()
    expect(document.querySelector('[data-iris-virtual-scroll]')).toBeNull()
    expect(document.querySelector('[data-iris-virtual-spacer]')).toBeNull()
    expect(document.querySelector('[data-iris-virtual-item]')).toBeNull()
    rerender(<IrisTree nodes={nodes} virtual={undefined} />)
    expect(document.querySelector('[data-iris-virtual-scroll]')).toBeNull()
    expect(items().length).toBe(2)
  })

  it('virtual does not leak to the DOM (destructured out of ...rest)', () => {
    const { rerender } = render(<IrisTree nodes={nodes} virtual={virtual} />)
    expect(virtualRoot().hasAttribute('virtual')).toBe(false)
    rerender(<IrisTree nodes={nodes} />)
    expect(document.querySelector('[data-iris-tree]')!.hasAttribute('virtual')).toBe(false)
  })

  // Heavy scale test: 5k-row trees + multiple rAF flush cycles run far slower
  // under parallel CI load than isolated — give the full acceptance an
  // explicit budget.
  it('A3: roving navigation scrolls + focuses the active row across 5,000 rows', async () => {
    render(<IrisTree nodes={many(5000)} virtual={virtual} />)
    const root = virtualRoot()
    act(() => {
      root.focus()
    })
    // 30× ArrowDown — each commit scrolls to the new active row.
    for (let i = 0; i < 30; i += 1) {
      act(() => {
        fireEvent.keyDown(root, { key: 'ArrowDown' })
      })
    }
    // scrollToIndex set the host offset synchronously (jsdom viewport 0 → no
    // end-clamp: 30 × 28 = 840).
    expect(root.scrollTop).toBe(30 * 28)
    await flushVirtual()
    // The windowed row mounts, stays active with roving tabIndex, and focus
    // follows it across the window.
    const row30 = document.querySelector('[data-iris-tree-node="30"]') as HTMLElement
    expect(row30).not.toBeNull()
    expect(row30.getAttribute('data-state')).toBe('active')
    expect(row30.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(row30)
    expect(Math.min(...renderedIndices())).toBeGreaterThanOrEqual(26)
    expect(Math.max(...renderedIndices())).toBeLessThan(34)

    // Home → first row.
    act(() => {
      fireEvent.keyDown(root, { key: 'Home' })
    })
    await flushVirtual()
    expect(root.scrollTop).toBe(0)
    expect(document.activeElement).toBe(document.querySelector('[data-iris-tree-node="0"]'))

    // End → last row. jsdom viewport collapse: align=start clamps to
    // totalSize − 0 → 4999 × 28 = 139972 (table test documents the quirk).
    act(() => {
      fireEvent.keyDown(root, { key: 'End' })
    })
    expect(root.scrollTop).toBe(4999 * 28)
    await flushVirtual()
    expect(document.querySelector('[data-iris-tree-node="4999"]')).not.toBeNull()
    expect(document.activeElement).toBe(document.querySelector('[data-iris-tree-node="4999"]'))
    const endIdxs = renderedIndices()
    expect(Math.min(...endIdxs)).toBeGreaterThanOrEqual(4995)
    expect(Math.max(...endIdxs)).toBeLessThan(5000)

    // ArrowUp at the first row clamps (active stays "0").
    act(() => {
      fireEvent.keyDown(root, { key: 'Home' })
    })
    await flushVirtual()
    act(() => {
      fireEvent.keyDown(root, { key: 'ArrowUp' })
    })
    expect(document.querySelector('[data-state=active]')?.getAttribute('data-iris-tree-node')).toBe(
      '0',
    )
    expect(root.scrollTop).toBe(0)

    // Control: same navigation without `virtual` renders every row.
    cleanup()
    render(<IrisTree nodes={many(5000)} />)
    const plainRoot = document.querySelector('[role=tree]') as HTMLElement
    for (let i = 0; i < 30; i += 1) {
      act(() => {
        fireEvent.keyDown(plainRoot, { key: 'ArrowDown' })
      })
    }
    expect(items().length).toBe(5000)
    expect(document.querySelector('[data-state=active]')?.getAttribute('data-iris-tree-node')).toBe(
      '30',
    )
  }, 15_000)

  it('A4: expanding a node preserves the scroll position (5,000 + 1,000 children)', async () => {
    const withKids = many(5000)
    withKids[2500] = {
      ...withKids[2500]!,
      children: Array.from({ length: 1000 }, (_, j) => ({ id: `c${j}`, label: `C${j}` })),
    }
    render(<IrisTree nodes={withKids} virtual={virtual} />)
    const root = virtualRoot()
    // Scroll to 70,000px → window head at index 2500 (70000 / 28).
    act(() => {
      root.scrollTop = 70000
      fireEvent.scroll(root)
    })
    await flushVirtual()
    expect(root.scrollTop).toBe(70000)
    const idxs = renderedIndices()
    expect(Math.min(...idxs)).toBeGreaterThanOrEqual(2496)
    expect(Math.max(...idxs)).toBeLessThan(2504)
    expect(document.querySelector('[data-iris-tree-node="2500"]')).not.toBeNull()

    // Expand node 2500 → 1,000 children inserted below it.
    const toggle = document.querySelector(
      '[data-iris-tree-node="2500"] [data-iris-tree-toggle]',
    ) as HTMLButtonElement
    act(() => {
      fireEvent.click(toggle)
    })
    // Scroll preserved (never reset to 0); window still bounded; the window
    // head shows node 2500 + its first children.
    expect(root.scrollTop).toBe(70000)
    expect(items().length).toBeGreaterThan(0)
    expect(items().length).toBeLessThanOrEqual(23)
    const idxs2 = renderedIndices()
    expect(Math.min(...idxs2)).toBeGreaterThanOrEqual(2496)
    expect(Math.max(...idxs2)).toBeLessThan(2504)
    expect(document.querySelector('[data-iris-tree-node="2500"]')).not.toBeNull()
    expect(document.querySelector('[data-iris-tree-node="c0"]')).not.toBeNull()
    expect(document.querySelector('[data-iris-tree-node="c2"]')).not.toBeNull()
    expect(document.querySelector('[data-iris-tree-node="c3"]')).toBeNull()
    expect(
      document.querySelector('[data-iris-tree-node="2500"]')!.getAttribute('aria-expanded'),
    ).toBe('true')

    // Control: the same expand without `virtual` renders all ~6,000 rows.
    cleanup()
    render(<IrisTree nodes={withKids} defaultExpanded={['2500']} />)
    expect(items().length).toBe(6000)
  }, 15_000)

  it('A5: row attributes (aria/roving/checkable) survive windowed rendering', () => {
    const nested: IrisTreeNode[] = [
      {
        id: 'root',
        label: 'Root',
        children: [
          { id: 'a', label: 'A', children: [{ id: 'a1', label: 'A1' }] },
          { id: 'b', label: 'B' },
        ],
      },
    ]
    render(
      <IrisTree
        nodes={nested}
        virtual={virtual}
        defaultExpanded={['root', 'a']}
        checkable
        selectionMode="multi"
        defaultSelected={['a1']}
        defaultChecked={['a1']}
      />,
    )
    // Buffer-only window in jsdom: [0, 4) covers root/a/a1/b — all mounted.
    const rows = items()
    expect(rows.length).toBe(4)
    for (const row of rows) {
      expect(row.getAttribute('data-iris-tree-node')).toBeTruthy()
    }
    expect(document.querySelector('[data-iris-tree-node=root]')!.getAttribute('aria-level')).toBe(
      '1',
    )
    expect(document.querySelector('[data-iris-tree-node=a1]')!.getAttribute('aria-level')).toBe('3')
    // Toggle buttons keep expand/collapse labels + aria-expanded.
    const rootToggle = document.querySelector('[data-iris-tree-node=root] [data-iris-tree-toggle]')!
    expect(rootToggle.getAttribute('aria-label')).toBe('Collapse')
    expect(
      document.querySelector('[data-iris-tree-node=root]')!.getAttribute('aria-expanded'),
    ).toBe('true')
    // Checkboxes keep checked state.
    const a1Box = document.querySelector(
      '[data-iris-tree-node=a1] [data-iris-tree-checkbox]',
    ) as HTMLInputElement
    expect(a1Box.checked).toBe(true)
    // Selection + roving attributes.
    expect(document.querySelector('[data-iris-tree-node=a1]')!.getAttribute('aria-selected')).toBe(
      'true',
    )
    expect(document.querySelector('[data-iris-tree-node=root]')!.getAttribute('tabindex')).toBe('0')
    expect(document.querySelector('[data-iris-tree-node=b]')!.getAttribute('tabindex')).toBe('-1')
  })

  it('virtual + loading/error/empty keeps the state node (no scroller)', () => {
    render(<IrisTree nodes={[]} virtual={virtual} loading />)
    expect(document.querySelector('[data-iris-virtual-scroll]')).toBeNull()
    expect(
      document.querySelector('[data-iris-tree-state]')?.getAttribute('data-iris-tree-state'),
    ).toBe('loading')
    expect(document.querySelector('[role=tree]')?.getAttribute('aria-busy')).toBe('true')
  })
})
