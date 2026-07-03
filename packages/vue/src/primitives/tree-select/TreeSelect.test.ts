import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisTreeSelect, type IrisTreeSelectNode } from './TreeSelect'

const OPTIONS: IrisTreeSelectNode[] = [
  {
    label: 'Fruits',
    value: 'fruits',
    children: [
      { label: 'Apple', value: 'apple' },
      { label: 'Banana', value: 'banana', disabled: true },
    ],
  },
  { label: 'Veggies', value: 'veg', children: [{ label: 'Carrot', value: 'carrot' }] },
]

const trigger = (w: ReturnType<typeof mount>) => w.find('[data-iris-tree-select-trigger]')

describe('IrisTreeSelect', () => {
  it('shows the placeholder, closed initially', () => {
    const w = mount(IrisTreeSelect, { props: { options: OPTIONS, placeholder: 'Pick' } })
    expect(w.find('[role="tree"]').exists()).toBe(false)
    expect(w.find('[data-iris-tree-select-value]').text()).toBe('Pick')
    expect(trigger(w).attributes('aria-haspopup')).toBe('tree')
  })

  it('opens the tree showing root nodes only (collapsed)', async () => {
    const w = mount(IrisTreeSelect, { props: { options: OPTIONS } })
    await trigger(w).trigger('click')
    expect(w.find('[role="tree"]').exists()).toBe(true)
    expect(w.findAll('[data-iris-tree-select-node]').length).toBe(2)
  })

  it('expands a node to reveal children', async () => {
    const w = mount(IrisTreeSelect, { props: { options: OPTIONS } })
    await trigger(w).trigger('click')
    await w.find('[data-value="fruits"] [data-iris-tree-select-toggle]').trigger('click')
    expect(w.find('[data-value="apple"]').exists()).toBe(true)
  })

  it('selects a leaf node, emits, and closes', async () => {
    const w = mount(IrisTreeSelect, { props: { options: OPTIONS, defaultExpanded: ['fruits'] } })
    await trigger(w).trigger('click')
    await w.find('[data-value="apple"] [data-iris-tree-select-label]').trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['apple'])
    expect(w.find('[role="tree"]').exists()).toBe(false)
  })

  it('reflects the selected value (nested) in the trigger', () => {
    const w = mount(IrisTreeSelect, { props: { options: OPTIONS, modelValue: 'carrot' } })
    expect(w.find('[data-iris-tree-select-value]').text()).toBe('Carrot')
  })

  it('does not select a disabled node', async () => {
    const w = mount(IrisTreeSelect, { props: { options: OPTIONS, defaultExpanded: ['fruits'] } })
    await trigger(w).trigger('click')
    await w.find('[data-value="banana"] [data-iris-tree-select-label]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  describe('ARIA & data attributes', () => {
    it('toggles aria-expanded on trigger', async () => {
      const w = mount(IrisTreeSelect, { props: { options: OPTIONS } })
      expect(trigger(w).attributes('aria-expanded')).toBe('false')
      await trigger(w).trigger('click')
      expect(trigger(w).attributes('aria-expanded')).toBe('true')
      await trigger(w).trigger('click')
      expect(trigger(w).attributes('aria-expanded')).toBe('false')
    })

    it('sets aria-invalid when invalid', () => {
      const w = mount(IrisTreeSelect, { props: { options: OPTIONS, invalid: true } })
      expect(trigger(w).attributes('aria-invalid')).toBe('true')
    })

    it('has data-state on container', async () => {
      const w = mount(IrisTreeSelect, { props: { options: OPTIONS } })
      const root = w.find('[data-iris-tree-select]')
      expect(root.attributes('data-state')).toBe('closed')
      await trigger(w).trigger('click')
      expect(root.attributes('data-state')).toBe('open')
    })
  })

  describe('keyboard', () => {
    it('ArrowDown opens the panel when closed', async () => {
      const w = mount(IrisTreeSelect, { props: { options: OPTIONS } })
      expect(w.find('[role="tree"]').exists()).toBe(false)
      await trigger(w).trigger('keydown', { key: 'ArrowDown' })
      expect(w.find('[role="tree"]').exists()).toBe(true)
    })

    it('Escape closes the panel', async () => {
      const w = mount(IrisTreeSelect, { props: { options: OPTIONS } })
      await trigger(w).trigger('click')
      expect(w.find('[role="tree"]').exists()).toBe(true)
      await trigger(w).trigger('keydown', { key: 'Escape' })
      expect(w.find('[role="tree"]').exists()).toBe(false)
    })
  })

  describe('disabled state', () => {
    it('disables the trigger when disabled', () => {
      const w = mount(IrisTreeSelect, { props: { options: OPTIONS, disabled: true } })
      expect(trigger(w).attributes('disabled')).toBe('')
    })

    it('does not open on click when disabled', async () => {
      const w = mount(IrisTreeSelect, { props: { options: OPTIONS, disabled: true } })
      await trigger(w).trigger('click')
      expect(w.find('[role="tree"]').exists()).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('handles empty options', async () => {
      const w = mount(IrisTreeSelect, { props: { options: [] } })
      await trigger(w).trigger('click')
      // Should not crash; tree may be empty
      expect(w.find('[data-iris-tree-select]').exists()).toBe(true)
    })
  })
})
