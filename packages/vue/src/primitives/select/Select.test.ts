import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisSelect } from './Select'
import type { IrisListItem } from '../list/List'

const items: IrisListItem<string>[] = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana' },
  { value: 'c', label: 'Cherry' },
]

describe('IrisSelect', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => {
    host.remove()
  })

  it('renders a trigger with the placeholder when no value', () => {
    const wrapper = mount(IrisSelect, {
      props: { items, modelValue: null, placeholder: 'Pick' },
      attachTo: host,
    })
    expect(wrapper.text()).toContain('Pick')
  })

  it('renders the selected item label', () => {
    const wrapper = mount(IrisSelect, {
      props: { items, modelValue: 'b' },
      attachTo: host,
    })
    expect(wrapper.text()).toContain('Banana')
  })

  it('opens the dropdown on trigger click', async () => {
    const wrapper = mount(IrisSelect, {
      props: { items, modelValue: null },
      attachTo: host,
    })
    expect(document.querySelector('[role="listbox"]')).toBeNull()
    await wrapper.find('[data-iris-select-trigger]').trigger('click')
    await nextTick()
    expect(document.querySelector('[role="listbox"]')).not.toBeNull()
  })

  it('renders the IrisList with the same items + modelValue when open', async () => {
    const wrapper = mount(IrisSelect, {
      props: { items, modelValue: 'b' },
      attachTo: host,
    })
    await wrapper.find('[data-iris-select-trigger]').trigger('click')
    await nextTick()
    // Selected option ("Banana", value 'b') should be marked aria-selected
    // when the listbox is rendered with the same modelValue.
    const selected = document.querySelector('[role="option"][aria-selected="true"]')
    expect(selected?.textContent?.trim()).toBe('Banana')
  })

  it('reflects updated v-model in the trigger label', async () => {
    const value = ref<string | null>(null)
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisSelect, {
            items,
            modelValue: value.value,
            'onUpdate:modelValue': (v) => (value.value = v as string),
          })
      },
    })
    const wrapper = mount(Harness, { attachTo: host })
    value.value = 'c'
    await nextTick()
    expect(wrapper.text()).toContain('Cherry')
  })

  it('disabled trigger renders with disabled attribute', () => {
    const wrapper = mount(IrisSelect, {
      props: { items, modelValue: null, disabled: true },
      attachTo: host,
    })
    expect(wrapper.find('[data-iris-select-trigger]').attributes('disabled')).toBeDefined()
  })

  it('reflects invalid state with aria-invalid', () => {
    const wrapper = mount(IrisSelect, {
      props: { items, modelValue: null, invalid: true },
      attachTo: host,
    })
    expect(wrapper.find('[data-iris-select-trigger]').attributes('aria-invalid')).toBe('true')
  })
})
