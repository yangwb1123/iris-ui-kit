import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisMonthPicker } from './MonthPicker'

function monthButton(value: string): HTMLButtonElement {
  return document.querySelector(`[data-iris-month-picker-month="${value}"]`) as HTMLButtonElement
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('@iris-ui-kit/vue IrisMonthPicker', () => {
  it('renders a localized month trigger and a twelve-month panel', async () => {
    const wrapper = mount(IrisMonthPicker, {
      props: { modelValue: new Date(2026, 8, 15), locale: 'zh-CN' },
      attachTo: document.body,
    })

    const trigger = wrapper.get('[data-iris-month-picker-trigger]')
    expect(trigger.attributes('data-iris-month-picker-value')).toBe('2026-09')
    expect(trigger.text()).toContain('2026')

    await trigger.trigger('click')
    await nextTick()

    expect(document.querySelectorAll('[data-iris-month-picker-month]')).toHaveLength(12)
    expect(document.querySelector('input[type="month"]')).toBeNull()
    expect(document.querySelector('select')).toBeNull()
    wrapper.unmount()
  })

  it('emits the first local day of the selected month and closes', async () => {
    const wrapper = mount(IrisMonthPicker, {
      props: { modelValue: new Date(2026, 8, 15) },
      attachTo: document.body,
    })

    await wrapper.get('[data-iris-month-picker-trigger]').trigger('click')
    await nextTick()
    monthButton('2026-08').click()
    await nextTick()

    const value = wrapper.emitted('update:modelValue')?.[0]?.[0] as Date
    expect(value.getFullYear()).toBe(2026)
    expect(value.getMonth()).toBe(7)
    expect(value.getDate()).toBe(1)
    expect(document.querySelector('[data-iris-month-picker-panel]')).toBeNull()
    wrapper.unmount()
  })

  it('navigates by year without changing the selected value', async () => {
    const wrapper = mount(IrisMonthPicker, {
      props: { modelValue: new Date(2026, 8, 15) },
      attachTo: document.body,
    })

    await wrapper.get('[data-iris-month-picker-trigger]').trigger('click')
    await nextTick()
    ;(document.querySelector('[data-iris-month-picker-next]') as HTMLButtonElement).click()
    await nextTick()

    expect(document.querySelector('[data-iris-month-picker-year]')?.textContent).toBe('2027')
    expect(monthButton('2027-09')).not.toBeNull()
    expect(
      wrapper.get('[data-iris-month-picker-trigger]').attributes('data-iris-month-picker-value'),
    ).toBe('2026-09')
    wrapper.unmount()
  })

  it('compares min and max at month precision', async () => {
    const wrapper = mount(IrisMonthPicker, {
      props: {
        modelValue: new Date(2024, 5, 15),
        min: new Date(2024, 5, 20),
        max: new Date(2024, 7, 2),
      },
      attachTo: document.body,
    })

    await wrapper.get('[data-iris-month-picker-trigger]').trigger('click')
    await nextTick()
    expect(monthButton('2024-05').disabled).toBe(true)
    expect(monthButton('2024-06').disabled).toBe(false)
    expect(monthButton('2024-08').disabled).toBe(false)
    expect(monthButton('2024-09').disabled).toBe(true)
    wrapper.unmount()
  })

  it('forwards form attributes and handles invalid/disabled states', () => {
    const wrapper = mount(IrisMonthPicker, {
      props: {
        id: 'month-field',
        ariaDescribedby: 'month-error',
        invalid: true,
        disabled: true,
      },
      attachTo: document.body,
    })
    const trigger = wrapper.get('[data-iris-month-picker-trigger]')
    expect(trigger.attributes('id')).toBe('month-field')
    expect(trigger.attributes('aria-describedby')).toBe('month-error')
    expect(trigger.attributes('aria-invalid')).toBe('true')
    expect((trigger.element as HTMLButtonElement).disabled).toBe(true)
    wrapper.unmount()
  })

  it('does not throw for malformed locales', () => {
    expect(() =>
      mount(IrisMonthPicker, {
        props: { modelValue: new Date(2026, 8, 1), locale: 'bad locale!' },
        attachTo: document.body,
      }).unmount(),
    ).not.toThrow()
  })
})
