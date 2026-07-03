import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisRadio, IrisRadioGroup } from './Radio'

describe('IrisRadioGroup + IrisRadio', () => {
  it('renders role=radiogroup wrapper', () => {
    const wrapper = mount(IrisRadioGroup, {
      slots: { default: () => h(IrisRadio, { value: 'a' }, () => 'A') },
    })
    expect(wrapper.attributes('role')).toBe('radiogroup')
  })

  it('checks the radio whose value matches modelValue', () => {
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisRadioGroup, { modelValue: 'b' }, () => [
            h(IrisRadio, { value: 'a' }, () => 'A'),
            h(IrisRadio, { value: 'b' }, () => 'B'),
          ])
      },
    })
    const wrapper = mount(Harness)
    const inputs = wrapper.findAll('input')
    expect((inputs[0]!.element as HTMLInputElement).checked).toBe(false)
    expect((inputs[1]!.element as HTMLInputElement).checked).toBe(true)
  })

  it('clicking a radio emits update:modelValue with its value', async () => {
    const value = ref<string | null>(null)
    const Harness = defineComponent({
      setup() {
        return () =>
          h(
            IrisRadioGroup,
            { modelValue: value.value, 'onUpdate:modelValue': (v: string) => (value.value = v) },
            () => [h(IrisRadio, { value: 'a' }), h(IrisRadio, { value: 'b' })],
          )
      },
    })
    const wrapper = mount(Harness)
    await wrapper.findAll('input')[1]!.trigger('change')
    expect(value.value).toBe('b')
  })

  it('group disabled cascades to all radios', () => {
    const wrapper = mount(IrisRadioGroup, {
      props: { disabled: true },
      slots: { default: () => [h(IrisRadio, { value: 'a' }), h(IrisRadio, { value: 'b' })] },
    })
    for (const input of wrapper.findAll('input')) {
      expect(input.attributes('disabled')).toBeDefined()
    }
  })

  it('group name is forwarded to each radio', () => {
    const wrapper = mount(IrisRadioGroup, {
      props: { name: 'pet' },
      slots: { default: () => [h(IrisRadio, { value: 'cat' }), h(IrisRadio, { value: 'dog' })] },
    })
    const inputs = wrapper.findAll('input')
    expect(inputs[0]!.attributes('name')).toBe('pet')
    expect(inputs[1]!.attributes('name')).toBe('pet')
  })

  it('uncontrolled (no modelValue): clicking a radio checks it', async () => {
    const wrapper = mount(IrisRadioGroup, {
      slots: { default: () => [h(IrisRadio, { value: 'a' }), h(IrisRadio, { value: 'b' })] },
    })
    const inputs = wrapper.findAll('input')
    await inputs[1]!.trigger('change')
    expect((inputs[0]!.element as HTMLInputElement).checked).toBe(false)
    expect((inputs[1]!.element as HTMLInputElement).checked).toBe(true)
  })

  it('uncontrolled: defaultValue seeds the initial selection', () => {
    const wrapper = mount(IrisRadioGroup, {
      props: { defaultValue: 'b' },
      slots: { default: () => [h(IrisRadio, { value: 'a' }), h(IrisRadio, { value: 'b' })] },
    })
    const inputs = wrapper.findAll('input')
    expect((inputs[0]!.element as HTMLInputElement).checked).toBe(false)
    expect((inputs[1]!.element as HTMLInputElement).checked).toBe(true)
  })

  it('standalone IrisRadio (no group) works with v-model', async () => {
    const value = ref<string | null>(null)
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisRadio, {
            value: 'x',
            modelValue: value.value,
            'onUpdate:modelValue': (v: string) => (value.value = v),
          })
      },
    })
    const wrapper = mount(Harness)
    await wrapper.find('input').trigger('change')
    expect(value.value).toBe('x')
  })
})
