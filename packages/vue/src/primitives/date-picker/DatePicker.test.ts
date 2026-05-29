import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisDatePicker } from './DatePicker'

afterEach(() => vi.useRealTimers())

describe('@iris-ui/vue IrisDatePicker', () => {
  it('renders trigger with placeholder when no value', () => {
    const wrap = mount(IrisDatePicker, {
      props: { placeholder: 'Pick…', modelValue: null },
      attachTo: document.body,
    })
    const trig = wrap.find('[data-iris-date-picker-trigger]')
    expect(trig.text()).toBe('Pick…')
    wrap.unmount()
  })

  it('shows formatted date when value is set', () => {
    const wrap = mount(IrisDatePicker, {
      props: { modelValue: new Date(2024, 5, 15), locale: 'en-US' },
      attachTo: document.body,
    })
    const trig = wrap.find('[data-iris-date-picker-trigger]')
    expect(trig.text()).toMatch(/Jun.*15.*2024/)
    expect(trig.attributes('data-iris-date-picker-iso')).toBe('2024-06-15')
    wrap.unmount()
  })

  it('clicking trigger opens the calendar', async () => {
    const wrap = mount(IrisDatePicker, {
      props: { modelValue: null },
      attachTo: document.body,
    })
    expect(document.querySelector('[data-iris-calendar]')).toBeNull()
    await wrap.find('[data-iris-date-picker-trigger]').trigger('click')
    await nextTick()
    expect(document.querySelector('[data-iris-calendar]')).not.toBeNull()
    wrap.unmount()
  })

  it('selecting a date emits update:modelValue + closes calendar', async () => {
    const wrap = mount(IrisDatePicker, {
      props: { modelValue: null },
      attachTo: document.body,
    })
    await wrap.find('[data-iris-date-picker-trigger]').trigger('click')
    await nextTick()
    const today = new Date()
    const dayBtn = document.querySelector(
      `[data-iris-calendar-day-iso="${today.toISOString().slice(0, 10)}"]`,
    ) as HTMLButtonElement
    expect(dayBtn).not.toBeNull()
    dayBtn.click()
    await nextTick()
    await nextTick()
    expect(wrap.emitted('update:modelValue')?.length).toBe(1)
    wrap.unmount()
  })

  it('invalid sets aria-invalid on trigger', () => {
    const wrap = mount(IrisDatePicker, {
      props: { modelValue: null, invalid: true },
      attachTo: document.body,
    })
    expect(wrap.find('[data-iris-date-picker-trigger]').attributes('aria-invalid')).toBe('true')
    wrap.unmount()
  })

  it('disabled prevents trigger interaction', () => {
    const wrap = mount(IrisDatePicker, {
      props: { modelValue: null, disabled: true },
      attachTo: document.body,
    })
    expect(
      (wrap.find('[data-iris-date-picker-trigger]').element as HTMLButtonElement).disabled,
    ).toBe(true)
    wrap.unmount()
  })

  it('id and ariaDescribedby propagate (form field integration)', () => {
    const wrap = mount(IrisDatePicker, {
      props: { modelValue: null, id: 'dp-1', ariaDescribedby: 'hint-1' },
      attachTo: document.body,
    })
    const trig = wrap.find('[data-iris-date-picker-trigger]')
    expect(trig.attributes('id')).toBe('dp-1')
    expect(trig.attributes('aria-describedby')).toBe('hint-1')
    wrap.unmount()
  })
})
