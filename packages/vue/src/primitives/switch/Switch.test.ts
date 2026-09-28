import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisSwitch } from './Switch'
import { IrisSelect } from '../select/Select'

describe('IrisSwitch', () => {
  it('renders a checkbox with role=switch', () => {
    const wrapper = mount(IrisSwitch)
    const input = wrapper.find('input[type="checkbox"]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('role')).toBe('switch')
  })

  it('reflects modelValue via aria-checked', () => {
    const off = mount(IrisSwitch, { props: { modelValue: false } })
    const on = mount(IrisSwitch, { props: { modelValue: true } })
    expect(off.find('input').attributes('aria-checked')).toBe('false')
    expect(on.find('input').attributes('aria-checked')).toBe('true')
  })

  it('emits update:modelValue on change', async () => {
    const wrapper = mount(IrisSwitch, { props: { modelValue: false } })
    await wrapper.find('input').setValue(true)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
  })

  it('emits a change event with the new value', async () => {
    const wrapper = mount(IrisSwitch)
    await wrapper.find('input').setValue(true)
    expect(wrapper.emitted('change')?.[0]).toEqual([true])
  })

  it('renders disabled', () => {
    const wrapper = mount(IrisSwitch, { props: { disabled: true } })
    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
  })

  it('reflects state via data-state attribute', () => {
    const off = mount(IrisSwitch, { props: { modelValue: false } })
    const on = mount(IrisSwitch, { props: { modelValue: true } })
    expect(off.attributes('data-state')).toBe('unchecked')
    expect(on.attributes('data-state')).toBe('checked')
  })

  it('uses logical inline styles in RTL and LTR', async () => {
    const Harness = defineComponent({
      props: {
        dir: { type: String, required: true },
        checked: { type: Boolean, required: true },
      },
      setup(props) {
        return () =>
          h('div', { dir: props.dir }, [
            h(IrisSwitch, { modelValue: props.checked }),
            h(IrisSelect, {
              items: [{ value: 'a', label: 'Alpha' }],
              teleport: false,
            }),
          ])
      },
    })
    const wrapper = mount(Harness, { props: { dir: 'rtl', checked: false } })

    const assertStyles = (thumbOffset: string) => {
      const thumb = wrapper.find('[data-iris-switch] > span > span').element as HTMLSpanElement
      const trigger = wrapper.find('[data-iris-select-trigger]').element as HTMLButtonElement
      const arrow = trigger.querySelector('svg') as SVGElement
      expect(thumb.style.insetInlineStart).toBe(thumbOffset)
      expect(thumb.style.left).toBe('')
      expect(thumb.style.transition).toContain('inset-inline-start')
      expect(arrow.style.insetInlineEnd).toBe('8px')
      expect(arrow.style.right).toBe('')
      expect(trigger.style.paddingBlock).toBe('var(--iris-space-xs, 8px)')
      expect(trigger.style.paddingInlineStart).toBe('var(--iris-space-sm, 12px)')
      expect(trigger.style.paddingInlineEnd).toBe('var(--iris-space-xl, 24px)')
    }

    assertStyles('2px')
    await wrapper.setProps({ dir: 'rtl', checked: true })
    assertStyles('calc(36px - 16px - 2px)')
    await wrapper.setProps({ dir: 'ltr', checked: false })
    assertStyles('2px')
  })
})
