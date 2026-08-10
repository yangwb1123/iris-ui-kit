import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTree } from './Tree'
import type { IrisTreeNode } from './types'

enableAutoUnmount(afterEach)

const sampleNodes: IrisTreeNode[] = [
  {
    id: 'a',
    label: 'A',
    children: [
      { id: 'a1', label: 'A1' },
      {
        id: 'a2',
        label: 'A2',
        children: [{ id: 'a2x', label: 'A2X' }],
      },
    ],
  },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C', isLeaf: true },
]

type TreeItemWrapper = import('@vue/test-utils').DOMWrapper<Element>
const labelOf = (treeItem: TreeItemWrapper) => treeItem.findAll('span').at(-1)?.text() ?? ''

describe('IrisTree', () => {
  it('renders top-level nodes only when nothing is expanded', () => {
    const wrapper = mount(IrisTree, { props: { nodes: sampleNodes } })
    const items = wrapper.findAll('[role="treeitem"]')
    expect(items.length).toBe(3)
    expect(items.map(labelOf)).toEqual(['A', 'B', 'C'])
  })

  it('renders children of expanded nodes', () => {
    const wrapper = mount(IrisTree, {
      props: { nodes: sampleNodes, defaultExpanded: ['a'] },
    })
    const labels = wrapper.findAll('[role="treeitem"]').map(labelOf)
    expect(labels).toContain('A1')
    expect(labels).toContain('A2')
    expect(labels).not.toContain('A2X')
  })

  it('clicking the chevron toggles expand state', async () => {
    const wrapper = mount(IrisTree, { props: { nodes: sampleNodes } })
    const firstChevron = wrapper.find('[data-iris-tree-chevron]')
    await firstChevron.trigger('click')
    await nextTick()
    expect(wrapper.findAll('[role="treeitem"]').length).toBe(5) // A + A1 + A2 + B + C
  })

  it('clicking the row selects it (single mode default)', async () => {
    const wrapper = mount(IrisTree, { props: { nodes: sampleNodes } })
    await wrapper.findAll('[role="treeitem"]')[1]!.trigger('click')
    await nextTick()
    expect(wrapper.findAll('[role="treeitem"]')[1]!.attributes('aria-selected')).toBe('true')
  })

  it('multi mode: emits an array, toggling adds/removes', async () => {
    const selected = ref<string[]>([])
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisTree, {
            nodes: sampleNodes,
            selectionMode: 'multi',
            selected: selected.value,
            'onUpdate:selected': (v: string[]) => (selected.value = v),
          })
      },
    })
    const wrapper = mount(Harness)
    const items = wrapper.findAll('[role="treeitem"]')
    await items[0]!.trigger('click')
    await items[1]!.trigger('click')
    await nextTick()
    expect(selected.value.sort()).toEqual(['a', 'b'])
  })

  it('ArrowRight expands then moves into first child', async () => {
    const wrapper = mount(IrisTree, { props: { nodes: sampleNodes } })
    await wrapper.findAll('[role="treeitem"]')[0]!.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    // Now node is expanded; second ArrowRight moves to first child.
    await wrapper.findAll('[role="treeitem"]')[0]!.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    const activeItem = wrapper
      .findAll('[role="treeitem"]')
      .find((i) => i.attributes('tabindex') === '0')!
    expect(labelOf(activeItem)).toBe('A1')
  })

  it('ArrowLeft collapses an expanded node, or moves to parent', async () => {
    const wrapper = mount(IrisTree, { props: { nodes: sampleNodes, defaultExpanded: ['a'] } })
    const a1 = wrapper.findAll('[role="treeitem"]').find((i) => labelOf(i) === 'A1')!
    await a1.trigger('focus')
    await a1.trigger('keydown', { key: 'ArrowLeft' })
    await nextTick()
    const active = wrapper
      .findAll('[role="treeitem"]')
      .find((i) => i.attributes('tabindex') === '0')!
    expect(labelOf(active)).toBe('A')
  })

  it('roving tabindex: only one node has tabindex=0', () => {
    const wrapper = mount(IrisTree, { props: { nodes: sampleNodes, defaultExpanded: ['a'] } })
    const zeroes = wrapper
      .findAll('[role="treeitem"]')
      .filter((i) => i.attributes('tabindex') === '0')
    expect(zeroes.length).toBe(1)
  })

  it('disabled node is not selectable', async () => {
    const wrapper = mount(IrisTree, {
      props: {
        nodes: [{ id: 'd', label: 'D', disabled: true }] as IrisTreeNode[],
      },
    })
    await wrapper.find('[role="treeitem"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[role="treeitem"]').attributes('aria-selected')).toBe('false')
  })

  it('aria-level reflects depth', () => {
    const wrapper = mount(IrisTree, {
      props: { nodes: sampleNodes, defaultExpanded: ['a', 'a2'] },
    })
    const a2x = wrapper.findAll('[role="treeitem"]').find((i) => labelOf(i) === 'A2X')!
    expect(a2x.attributes('aria-level')).toBe('3')
  })

  it('isLeaf hides the chevron and skips aria-expanded', () => {
    const wrapper = mount(IrisTree, { props: { nodes: sampleNodes } })
    const cItem = wrapper.findAll('[role="treeitem"]').find((i) => labelOf(i) === 'C')!
    expect(cItem.attributes('aria-expanded')).toBeUndefined()
  })

  it('async loadChildren resolves and caches', async () => {
    const lazy: IrisTreeNode[] = [
      { id: 'root', label: 'Root', loadChildren: async () => [{ id: 'kid', label: 'Kid' }] },
    ]
    const wrapper = mount(IrisTree, { props: { nodes: lazy } })
    await wrapper.find('[data-iris-tree-chevron]').trigger('click')
    // Wait for promise to flush.
    await Promise.resolve()
    await nextTick()
    await nextTick()
    const labels = wrapper.findAll('[role="treeitem"]').map((i) => i.text())
    expect(labels).toContain('Kid')
  })

  it('async load failure auto-collapses and marks error', async () => {
    const lazy: IrisTreeNode[] = [
      {
        id: 'root',
        label: 'Root',
        loadChildren: async () => {
          throw new Error('nope')
        },
      },
    ]
    const wrapper = mount(IrisTree, { props: { nodes: lazy } })
    await wrapper.find('[data-iris-tree-chevron]').trigger('click')
    await Promise.resolve()
    await Promise.resolve()
    await nextTick()
    const root = wrapper.find('[role="treeitem"][data-id="root"]')
    expect(root.attributes('aria-expanded')).toBe('false')
    expect(root.attributes('data-error')).toBeDefined()
  })
})

describe('IrisTree RTL', () => {
  it('indents with logical inline-start padding (RTL-safe)', () => {
    const wrapper = mount(IrisTree, { props: { nodes: sampleNodes } })
    const item = wrapper.find('[data-iris-tree-item]').element as HTMLElement
    // Indentation is applied via the logical inline-start property (RTL-safe).
    expect(item.style.paddingInlineStart).toBeTruthy()
  })
})

describe('IrisTree checkable', () => {
  const checkNodes: IrisTreeNode[] = [
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

  const checkboxFor = (wrapper: ReturnType<typeof mount>, id: string) =>
    wrapper.find(`[role="treeitem"][data-id="${id}"] [data-iris-tree-checkbox]`)

  it('renders a checkbox per node when checkable', () => {
    const wrapper = mount(IrisTree, {
      props: { nodes: checkNodes, checkable: true, expanded: ['root', 'a'] },
    })
    expect(checkboxFor(wrapper, 'root').exists()).toBe(true)
    expect(checkboxFor(wrapper, 'a1').exists()).toBe(true)
  })

  it('checking a parent cascades to its (enabled) descendants and fires checkedChange', async () => {
    const checked = ref<string[] | null>(null)
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisTree, {
            nodes: checkNodes,
            checkable: true,
            expanded: ['root', 'a'],
            onCheckedChange: (v: string[]) => (checked.value = v),
          })
      },
    })
    const wrapper = mount(Harness)
    const aCheckbox = wrapper.find('[role="treeitem"][data-id="a"] [data-iris-tree-checkbox]')
    await aCheckbox.setValue(true)
    await nextTick()
    expect(
      (
        wrapper.find('[role="treeitem"][data-id="a1"] [data-iris-tree-checkbox]')
          .element as HTMLInputElement
      ).checked,
    ).toBe(true)
    expect(
      (
        wrapper.find('[role="treeitem"][data-id="a"] [data-iris-tree-checkbox]')
          .element as HTMLInputElement
      ).checked,
    ).toBe(true)
    expect(checked.value).not.toBeNull()
    expect(checked.value).toContain('a1')
  })

  it('a partially-checked parent is indeterminate (aria mixed)', () => {
    const wrapper = mount(IrisTree, {
      props: {
        nodes: checkNodes,
        checkable: true,
        expanded: ['root', 'a'],
        defaultChecked: ['a1'],
      },
    })
    // root has only some descendants checked → indeterminate (aria mixed).
    const root = checkboxFor(wrapper, 'root')
    expect(root.attributes('aria-checked')).toBe('mixed')
    expect((root.element as HTMLInputElement).indeterminate).toBe(true)
  })

  it('no checkboxes when checkable is off', () => {
    const wrapper = mount(IrisTree, {
      props: { nodes: checkNodes, expanded: ['root'] },
    })
    expect(checkboxFor(wrapper, 'root').exists()).toBe(false)
  })
})

describe('IrisTree data states', () => {
  it('shows the localized empty state when nodes is empty', () => {
    const w = mount(IrisTree, { props: { nodes: [] } })
    const node = w.find('[data-iris-tree-state]')
    expect(node.attributes('data-iris-tree-state')).toBe('empty')
    expect(node.text()).toBe('No items to display')
  })

  it('shows loading with aria-busy; error takes precedence', async () => {
    const w = mount(IrisTree, { props: { nodes: [], loading: true } })
    expect(w.find('[data-iris-tree-state]').attributes('data-iris-tree-state')).toBe('loading')
    expect(w.find('[role=tree]').attributes('aria-busy')).toBe('true')
    await w.setProps({ loading: true, error: true })
    expect(w.find('[data-iris-tree-state]').attributes('data-iris-tree-state')).toBe('error')
  })

  it('renders nodes (no state node) when content is present', () => {
    const w = mount(IrisTree, { props: { nodes: [{ id: 'a', label: 'A' }] } })
    expect(w.find('[data-iris-tree-state]').exists()).toBe(false)
    expect(w.find('[data-iris-tree-item]').exists()).toBe(true)
  })

  it('keeps nodes mounted during revalidate (SWR) with aria-busy', () => {
    const w = mount(IrisTree, {
      props: { nodes: [{ id: 'a', label: 'A' }], loading: true },
    })
    expect(w.find('[data-iris-tree-state]').exists()).toBe(false)
    expect(w.findAll('[data-iris-tree-item]').length).toBe(1)
    expect(w.find('[role=tree]').attributes('aria-busy')).toBe('true')
  })

  it('keeps nodes mounted when revalidate also errors (stale-while-revalidate)', () => {
    const w = mount(IrisTree, {
      props: { nodes: [{ id: 'a', label: 'A' }], loading: true, error: true },
    })
    expect(w.find('[data-iris-tree-state]').exists()).toBe(false)
    expect(w.findAll('[data-iris-tree-item]').length).toBe(1)
    expect(w.find('[role=tree]').attributes('aria-busy')).toBe('true')
  })

  it('aria-busy tracks props.loading on the root, not the resolved state', async () => {
    const w = mount(IrisTree, { props: { nodes: [{ id: 'a', label: 'A' }] } })
    expect(w.find('[role=tree]').attributes('aria-busy')).toBeUndefined()
    await w.setProps({ loading: true })
    expect(w.find('[role=tree]').attributes('aria-busy')).toBe('true')
    // Empty nodes + loading still renders the state node (byte-identical
    // precedence), but the busy flag now also covers the error-over-loading case.
    await w.setProps({ nodes: [], loading: true })
    expect(w.find('[data-iris-tree-state]').attributes('data-iris-tree-state')).toBe('loading')
    await w.setProps({ loading: true, error: true })
    expect(w.find('[data-iris-tree-state]').attributes('data-iris-tree-state')).toBe('error')
    expect(w.find('[role=tree]').attributes('aria-busy')).toBe('true')
  })

  it('keeps keyboard navigation live during revalidate', async () => {
    const w = mount(IrisTree, {
      props: {
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        loading: true,
      },
    })
    await w.findAll('[data-iris-tree-item]')[0]!.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(w.findAll('[data-iris-tree-item]')[1]!.attributes('tabindex')).toBe('0')
  })
})
