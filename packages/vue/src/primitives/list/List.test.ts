import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisList, type IrisListItem } from './List'

const sampleItems: IrisListItem<string>[] = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana' },
  { value: 'c', label: 'Cherry', disabled: true },
  { value: 'd', label: 'Date' },
]

describe('IrisList', () => {
  it('renders one <li role="option"> per item', () => {
    const wrapper = mount(IrisList, { props: { items: sampleItems } })
    expect(wrapper.findAll('[role="option"]').length).toBe(4)
    expect(wrapper.attributes('role')).toBe('listbox')
  })

  it('marks the selected item with aria-selected', () => {
    const wrapper = mount(IrisList, { props: { items: sampleItems, modelValue: 'b' } })
    const options = wrapper.findAll('[role="option"]')
    expect(options[0]!.attributes('aria-selected')).toBe('false')
    expect(options[1]!.attributes('aria-selected')).toBe('true')
  })

  it('emits update:modelValue on click', async () => {
    const wrapper = mount(IrisList, { props: { items: sampleItems, modelValue: null } })
    await wrapper.findAll('[role="option"]')[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['b'])
  })

  it('does not emit on click of a disabled item', async () => {
    const wrapper = mount(IrisList, { props: { items: sampleItems, modelValue: null } })
    await wrapper.findAll('[role="option"]')[2]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('roving tabindex: first enabled item has tabindex=0, others -1', () => {
    const wrapper = mount(IrisList, { props: { items: sampleItems } })
    const options = wrapper.findAll('[role="option"]')
    expect(options[0]!.attributes('tabindex')).toBe('0')
    expect(options[1]!.attributes('tabindex')).toBe('-1')
  })

  it('ArrowDown moves active to next enabled item, skipping disabled', async () => {
    const wrapper = mount(IrisList, { props: { items: sampleItems } })
    const list = wrapper.find('[role="listbox"]')
    await list.trigger('keydown', { key: 'ArrowDown' }) // a -> b
    await nextTick()
    expect(wrapper.findAll('[role="option"]')[1]!.attributes('tabindex')).toBe('0')
    await list.trigger('keydown', { key: 'ArrowDown' }) // b -> d (skips disabled c)
    await nextTick()
    expect(wrapper.findAll('[role="option"]')[3]!.attributes('tabindex')).toBe('0')
  })

  it('ArrowUp moves active to previous enabled item', async () => {
    const wrapper = mount(IrisList, { props: { items: sampleItems } })
    const list = wrapper.find('[role="listbox"]')
    await list.trigger('keydown', { key: 'End' })
    await nextTick()
    await list.trigger('keydown', { key: 'ArrowUp' }) // d -> b (skips c)
    await nextTick()
    expect(wrapper.findAll('[role="option"]')[1]!.attributes('tabindex')).toBe('0')
  })

  it('Home and End jump to first/last enabled', async () => {
    const wrapper = mount(IrisList, { props: { items: sampleItems } })
    const list = wrapper.find('[role="listbox"]')
    await list.trigger('keydown', { key: 'End' })
    await nextTick()
    expect(wrapper.findAll('[role="option"]')[3]!.attributes('tabindex')).toBe('0')
    await list.trigger('keydown', { key: 'Home' })
    await nextTick()
    expect(wrapper.findAll('[role="option"]')[0]!.attributes('tabindex')).toBe('0')
  })

  it('Enter selects the active item', async () => {
    const wrapper = mount(IrisList, { props: { items: sampleItems, modelValue: null } })
    const list = wrapper.find('[role="listbox"]')
    await list.trigger('keydown', { key: 'ArrowDown' })
    await list.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['b'])
  })

  it('Space also selects', async () => {
    const wrapper = mount(IrisList, { props: { items: sampleItems, modelValue: null } })
    const list = wrapper.find('[role="listbox"]')
    await list.trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['a'])
  })

  it('multi mode: emits array; toggling adds/removes', async () => {
    const value = ref<string[]>([])
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisList, {
            items: sampleItems,
            multi: true,
            modelValue: value.value,
            'onUpdate:modelValue': (v) => (value.value = v as string[]),
          })
      },
    })
    const wrapper = mount(Harness)
    expect(wrapper.attributes('aria-multiselectable')).toBe('true')
    await wrapper.findAll('[role="option"]')[0]!.trigger('click')
    await nextTick()
    expect(value.value).toEqual(['a'])
    await wrapper.findAll('[role="option"]')[1]!.trigger('click')
    await nextTick()
    expect(value.value).toEqual(['a', 'b'])
    await wrapper.findAll('[role="option"]')[0]!.trigger('click')
    await nextTick()
    expect(value.value).toEqual(['b'])
  })

  it('loop=true wraps Down from last to first', async () => {
    const wrapper = mount(IrisList, { props: { items: sampleItems, loop: true } })
    const list = wrapper.find('[role="listbox"]')
    await list.trigger('keydown', { key: 'End' })
    await list.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(wrapper.findAll('[role="option"]')[0]!.attributes('tabindex')).toBe('0')
  })

  it('loop=false clamps at the ends', async () => {
    const wrapper = mount(IrisList, { props: { items: sampleItems, loop: false } })
    const list = wrapper.find('[role="listbox"]')
    await list.trigger('keydown', { key: 'End' })
    await list.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(wrapper.findAll('[role="option"]')[3]!.attributes('tabindex')).toBe('0')
  })

  it('renders custom items via the #item slot', () => {
    const wrapper = mount(IrisList, {
      props: { items: sampleItems },
      slots: {
        item: ({ item, selected }) =>
          h(
            'span',
            { class: 'custom' },
            `${(item as IrisListItem<string>).label}-${selected ? 'on' : 'off'}`,
          ),
      },
    })
    expect(wrapper.findAll('.custom').length).toBe(4)
  })
})

describe('IrisList data states', () => {
  it('shows the localized empty state when items is empty', () => {
    const w = mount(IrisList, { props: { items: [] } })
    const node = w.find('[data-iris-list-state]')
    expect(node.exists()).toBe(true)
    expect(node.attributes('data-iris-list-state')).toBe('empty')
    expect(node.text()).toBe('No items to display')
  })

  it('shows loading over empty, with aria-busy on the listbox', () => {
    const w = mount(IrisList, { props: { items: [], loading: true } })
    expect(w.find('[data-iris-list-state]').attributes('data-iris-list-state')).toBe('loading')
    expect(w.find('[role=listbox]').attributes('aria-busy')).toBe('true')
  })

  it('error takes precedence over loading', () => {
    const w = mount(IrisList, { props: { items: [], loading: true, error: true } })
    expect(w.find('[data-iris-list-state]').attributes('data-iris-list-state')).toBe('error')
  })

  it('renders a custom state via the #error slot', () => {
    const w = mount(IrisList, {
      props: { items: [], error: true },
      slots: { error: () => h('span', { class: 'boom' }, 'Boom') },
    })
    expect(w.find('.boom').exists()).toBe(true)
  })

  it('renders options (no state node) when content is present', () => {
    const w = mount(IrisList, { props: { items: sampleItems } })
    expect(w.find('[data-iris-list-state]').exists()).toBe(false)
    expect(w.findAll('[role=option]').length).toBe(sampleItems.length)
  })

  it('applies the enter-animation class on the state node', () => {
    const w = mount(IrisList, { props: { items: [], loading: true } })
    expect(w.find('[data-iris-list-state]').classes()).toContain('iris-data-state-enter')
  })

  it('keeps options mounted during revalidate (SWR) with aria-busy', () => {
    const w = mount(IrisList, { props: { items: sampleItems, loading: true } })
    expect(w.find('[data-iris-list-state]').exists()).toBe(false)
    expect(w.findAll('[role=option]').length).toBe(sampleItems.length)
    expect(w.find('[role=listbox]').attributes('aria-busy')).toBe('true')
  })

  it('keeps options mounted when revalidate also errors (stale-while-revalidate)', () => {
    const w = mount(IrisList, { props: { items: sampleItems, loading: true, error: true } })
    expect(w.find('[data-iris-list-state]').exists()).toBe(false)
    expect(w.findAll('[role=option]').length).toBe(sampleItems.length)
    expect(w.find('[role=listbox]').attributes('aria-busy')).toBe('true')
  })

  it('aria-busy tracks props.loading on the root, not the resolved state', async () => {
    const w = mount(IrisList, { props: { items: sampleItems } })
    expect(w.find('[role=listbox]').attributes('aria-busy')).toBeUndefined()
    await w.setProps({ loading: true })
    expect(w.find('[role=listbox]').attributes('aria-busy')).toBe('true')
    // Empty content + loading still renders the state node (byte-identical
    // precedence), but the busy flag now also covers the error-over-loading case.
    await w.setProps({ items: [], loading: true })
    expect(w.find('[data-iris-list-state]').attributes('data-iris-list-state')).toBe('loading')
    await w.setProps({ loading: true, error: true })
    expect(w.find('[data-iris-list-state]').attributes('data-iris-list-state')).toBe('error')
    expect(w.find('[role=listbox]').attributes('aria-busy')).toBe('true')
  })

  it('keeps keyboard navigation live during revalidate', async () => {
    const w = mount(IrisList, { props: { items: sampleItems, loading: true } })
    await w.find('[role=listbox]').trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(w.findAll('[role=option]')[1]!.attributes('tabindex')).toBe('0')
  })
})
