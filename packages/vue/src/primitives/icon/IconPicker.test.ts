import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createIconRegistry } from '@iris-ui-kit/icons'
import { IrisIconPicker } from './IconPicker'

const categories = [{ id: 'common', label: 'Common', iconNames: ['check', 'folder'] }] as const

describe('@iris-ui-kit/vue IrisIconPicker', () => {
  it('renders searchable semantic options and filters by category', async () => {
    const wrapper = mount(IrisIconPicker, {
      props: { iconNames: ['check', 'folder', 'home'], categories },
    })
    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Icon picker')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(3)
    await wrapper.get('[data-iris-icon-picker-category="common"]').trigger('click')
    expect(wrapper.findAll('[role="option"]').map((node) => node.attributes('aria-label'))).toEqual(
      ['check', 'folder'],
    )
    await wrapper.get('input[type="search"]').setValue('folder')
    expect(wrapper.findAll('[role="option"]').map((node) => node.attributes('aria-label'))).toEqual(
      ['folder'],
    )
  })

  it('supports keyboard navigation, selection events, and the empty state', async () => {
    const wrapper = mount(IrisIconPicker, {
      attachTo: document.body,
      props: { iconNames: ['check', 'folder'] },
    })
    const search = wrapper.get('input[type="search"]')
    await search.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(wrapper.get('[role="option"][aria-label="check"]').element)
    await wrapper
      .get('[role="option"][aria-label="check"]')
      .trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(wrapper.get('[role="option"][aria-label="folder"]').element)
    await wrapper.get('[role="option"][aria-label="folder"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['folder'])
    expect(wrapper.emitted('valueChange')?.[0]).toEqual(['folder'])
    await wrapper.get('input[type="search"]').setValue('not-an-icon')
    expect(wrapper.find('[data-iris-icon-picker-empty]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('preserves a controlled selection and resolves a custom registry', async () => {
    const registry = createIconRegistry({
      icons: [{ name: 'custom', nodes: [{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 4 } }] }],
    })
    const wrapper = mount(IrisIconPicker, {
      props: { modelValue: 'custom', registry, label: 'Choose glyph' },
    })
    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Choose glyph')
    await wrapper.get('[role="option"][aria-label="custom"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['custom'])
    expect(wrapper.get('[role="option"][aria-label="custom"]').attributes('aria-selected')).toBe(
      'true',
    )
    await wrapper.setProps({ modelValue: undefined })
    await nextTick()
    expect(wrapper.get('[role="option"][aria-label="custom"]').attributes('aria-selected')).toBe(
      'true',
    )
  })
})
