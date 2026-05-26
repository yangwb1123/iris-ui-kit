import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisTimePicker } from './TimePicker'

afterEach(() => {})

describe('@iris-ui/vue IrisTimePicker', () => {
  it('renders 2 number inputs in 24h mode (no AM/PM toggle)', () => {
    const wrap = mount(IrisTimePicker, {
      props: { modelValue: { hours: 10, minutes: 30 } },
    })
    expect(wrap.find('[data-iris-time-picker-hours]').exists()).toBe(true)
    expect(wrap.find('[data-iris-time-picker-minutes]').exists()).toBe(true)
    expect(wrap.find('[data-iris-time-picker-meridiem]').exists()).toBe(false)
  })

  it('values display zero-padded', () => {
    const wrap = mount(IrisTimePicker, {
      props: { modelValue: { hours: 9, minutes: 5 } },
    })
    const h = wrap.find('[data-iris-time-picker-hours]').element as HTMLInputElement
    const m = wrap.find('[data-iris-time-picker-minutes]').element as HTMLInputElement
    expect(h.value).toBe('09')
    expect(m.value).toBe('05')
  })

  it('format=12h shows AM/PM toggle', () => {
    const wrap = mount(IrisTimePicker, {
      props: { modelValue: { hours: 13, minutes: 0 }, format: '12h' },
    })
    const toggle = wrap.find('[data-iris-time-picker-meridiem]')
    expect(toggle.exists()).toBe(true)
    expect(toggle.attributes('data-iris-time-picker-meridiem')).toBe('PM')
  })

  it('format=12h converts hours: 13 → 1 PM displayed', () => {
    const wrap = mount(IrisTimePicker, {
      props: { modelValue: { hours: 13, minutes: 0 }, format: '12h' },
    })
    const h = wrap.find('[data-iris-time-picker-hours]').element as HTMLInputElement
    expect(h.value).toBe('01')
  })

  it('typing hours emits update with 24h value', async () => {
    const wrap = mount(IrisTimePicker, {
      props: { modelValue: { hours: 0, minutes: 0 } },
    })
    const h = wrap.find('[data-iris-time-picker-hours]')
    ;(h.element as HTMLInputElement).value = '15'
    await h.trigger('input')
    const emit = wrap.emitted('update:modelValue')!
    expect(emit[0]![0]).toEqual({ hours: 15, minutes: 0 })
  })

  it('typing minutes emits update with rounded step', async () => {
    const wrap = mount(IrisTimePicker, {
      props: { modelValue: { hours: 10, minutes: 0 }, minuteStep: 5 },
    })
    const m = wrap.find('[data-iris-time-picker-minutes]')
    ;(m.element as HTMLInputElement).value = '13'
    await m.trigger('input')
    const emit = wrap.emitted('update:modelValue')!
    // 13 rounded to nearest 5 = 15
    expect(emit[0]![0]).toEqual({ hours: 10, minutes: 15 })
  })

  it('clamps hours over max (24h)', async () => {
    const wrap = mount(IrisTimePicker, {
      props: { modelValue: { hours: 0, minutes: 0 } },
    })
    const h = wrap.find('[data-iris-time-picker-hours]')
    ;(h.element as HTMLInputElement).value = '99'
    await h.trigger('input')
    const emit = wrap.emitted('update:modelValue')!
    expect((emit[0]![0] as { hours: number }).hours).toBe(23)
  })

  it('clamps minutes over max', async () => {
    const wrap = mount(IrisTimePicker, {
      props: { modelValue: { hours: 0, minutes: 0 } },
    })
    const m = wrap.find('[data-iris-time-picker-minutes]')
    ;(m.element as HTMLInputElement).value = '99'
    await m.trigger('input')
    const emit = wrap.emitted('update:modelValue')!
    expect((emit[0]![0] as { minutes: number }).minutes).toBe(59)
  })

  it('AM/PM toggle flips the 24h hour by 12', async () => {
    const wrap = mount(IrisTimePicker, {
      props: { modelValue: { hours: 3, minutes: 0 }, format: '12h' },
    })
    await wrap.find('[data-iris-time-picker-meridiem]').trigger('click')
    const emit = wrap.emitted('update:modelValue')!
    expect((emit[0]![0] as { hours: number }).hours).toBe(15)
  })

  it('ArrowUp on hours increments', async () => {
    const wrap = mount(IrisTimePicker, {
      props: { modelValue: { hours: 10, minutes: 0 } },
    })
    await wrap.find('[data-iris-time-picker-hours]').trigger('keydown', { key: 'ArrowUp' })
    const emit = wrap.emitted('update:modelValue')!
    expect((emit[0]![0] as { hours: number }).hours).toBe(11)
  })

  it('ArrowDown on minutes decrements by step', async () => {
    const wrap = mount(IrisTimePicker, {
      props: { modelValue: { hours: 10, minutes: 30 }, minuteStep: 5 },
    })
    await wrap.find('[data-iris-time-picker-minutes]').trigger('keydown', { key: 'ArrowDown' })
    const emit = wrap.emitted('update:modelValue')!
    expect((emit[0]![0] as { minutes: number }).minutes).toBe(25)
  })

  it('hours wraps around (24h: 23 → 0 on ArrowUp)', async () => {
    const wrap = mount(IrisTimePicker, {
      props: { modelValue: { hours: 23, minutes: 0 } },
    })
    await wrap.find('[data-iris-time-picker-hours]').trigger('keydown', { key: 'ArrowUp' })
    const emit = wrap.emitted('update:modelValue')!
    expect((emit[0]![0] as { hours: number }).hours).toBe(0)
  })

  it('disabled disables both inputs', () => {
    const wrap = mount(IrisTimePicker, {
      props: { modelValue: { hours: 0, minutes: 0 }, disabled: true },
    })
    expect(
      (wrap.find('[data-iris-time-picker-hours]').element as HTMLInputElement).disabled,
    ).toBe(true)
    expect(
      (wrap.find('[data-iris-time-picker-minutes]').element as HTMLInputElement).disabled,
    ).toBe(true)
  })

  it('invalid sets aria-invalid on hours', () => {
    const wrap = mount(IrisTimePicker, {
      props: { modelValue: { hours: 0, minutes: 0 }, invalid: true },
    })
    expect(
      wrap.find('[data-iris-time-picker-hours]').attributes('aria-invalid'),
    ).toBe('true')
  })

  it('id + ariaDescribedby forward to hours input (FormField wiring)', () => {
    const wrap = mount(IrisTimePicker, {
      props: { modelValue: { hours: 0, minutes: 0 }, id: 'tp-1', ariaDescribedby: 'hint' },
    })
    const h = wrap.find('[data-iris-time-picker-hours]')
    expect(h.attributes('id')).toBe('tp-1')
    expect(h.attributes('aria-describedby')).toBe('hint')
  })
})
