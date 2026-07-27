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
    expect(node.textContent).toBe('No items')
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
