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
    const activeItem = wrapper.findAll('[role="treeitem"]').find((i) => i.attributes('tabindex') === '0')!
    expect(labelOf(activeItem)).toBe('A1')
  })

  it('ArrowLeft collapses an expanded node, or moves to parent', async () => {
    const wrapper = mount(IrisTree, { props: { nodes: sampleNodes, defaultExpanded: ['a'] } })
    const a1 = wrapper.findAll('[role="treeitem"]').find((i) => labelOf(i) === 'A1')!
    await a1.trigger('focus')
    await a1.trigger('keydown', { key: 'ArrowLeft' })
    await nextTick()
    const active = wrapper.findAll('[role="treeitem"]').find((i) => i.attributes('tabindex') === '0')!
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
