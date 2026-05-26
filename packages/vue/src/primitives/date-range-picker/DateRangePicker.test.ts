import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { IrisDateRangePicker } from './DateRangePicker'

function clearBody() {
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild)
}

afterEach(() => clearBody())

describe('@iris-ui/vue IrisDateRangePicker', () => {
  it('renders trigger with placeholder when empty', () => {
    const wrap = mount(IrisDateRangePicker, {
      props: { modelValue: { start: null, end: null }, placeholder: 'Pick range…' },
      attachTo: document.body,
    })
    expect(wrap.find('[data-iris-date-range-picker-trigger]').text()).toBe('Pick range…')
    wrap.unmount()
  })

  it('shows start → … when only start is set', () => {
    const wrap = mount(IrisDateRangePicker, {
      props: {
        modelValue: { start: new Date(2024, 5, 10), end: null },
        locale: 'en-US',
      },
      attachTo: document.body,
    })
    const txt = wrap.find('[data-iris-date-range-picker-trigger]').text()
    expect(txt).toContain('→')
    expect(txt).toContain('…')
    wrap.unmount()
  })

  it('shows start → end when both set', () => {
    const wrap = mount(IrisDateRangePicker, {
      props: {
        modelValue: { start: new Date(2024, 5, 10), end: new Date(2024, 5, 20) },
        locale: 'en-US',
      },
      attachTo: document.body,
    })
    const txt = wrap.find('[data-iris-date-range-picker-trigger]').text()
    expect(txt).toContain('Jun 10')
    expect(txt).toContain('Jun 20')
    expect(txt).toContain('→')
    wrap.unmount()
  })

  it('clicking trigger opens two calendars', async () => {
    const wrap = mount(IrisDateRangePicker, {
      props: { modelValue: { start: null, end: null } },
      attachTo: document.body,
    })
    await wrap.find('[data-iris-date-range-picker-trigger]').trigger('click')
    await nextTick()
    const cals = document.querySelectorAll('[data-iris-calendar]')
    expect(cals.length).toBe(2)
    wrap.unmount()
  })

  it('first day click emits update with start set + end null', async () => {
    const wrap = mount(IrisDateRangePicker, {
      props: { modelValue: { start: null, end: null } },
      attachTo: document.body,
    })
    await wrap.find('[data-iris-date-range-picker-trigger]').trigger('click')
    await nextTick()
    const day = document.querySelectorAll(
      '[data-iris-calendar-day]',
    )[10] as HTMLButtonElement
    day.click()
    await nextTick()
    const emit = wrap.emitted('update:modelValue')!
    expect((emit[0]![0] as { start: Date; end: Date | null }).start).toBeInstanceOf(Date)
    expect((emit[0]![0] as { start: Date; end: Date | null }).end).toBeNull()
    wrap.unmount()
  })

  it('second day click completes range, swaps if before start', async () => {
    const wrap = mount(IrisDateRangePicker, {
      props: {
        modelValue: { start: new Date(2024, 5, 15), end: null },
      },
      attachTo: document.body,
    })
    await wrap.find('[data-iris-date-range-picker-trigger]').trigger('click')
    await nextTick()
    const second = document.querySelector(
      '[data-iris-calendar-day-iso="2024-06-10"]',
    ) as HTMLButtonElement
    expect(second).not.toBeNull()
    second.click()
    await nextTick()
    const emit = wrap.emitted('update:modelValue')!
    const next = emit[0]![0] as { start: Date; end: Date }
    expect(next.start.getDate()).toBe(10)
    expect(next.end.getDate()).toBe(15)
    wrap.unmount()
  })

  it('disabled blocks interaction', () => {
    const wrap = mount(IrisDateRangePicker, {
      props: { modelValue: { start: null, end: null }, disabled: true },
      attachTo: document.body,
    })
    expect(
      (wrap.find('[data-iris-date-range-picker-trigger]').element as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    wrap.unmount()
  })

  it('invalid sets aria-invalid', () => {
    const wrap = mount(IrisDateRangePicker, {
      props: { modelValue: { start: null, end: null }, invalid: true },
      attachTo: document.body,
    })
    expect(
      wrap.find('[data-iris-date-range-picker-trigger]').attributes('aria-invalid'),
    ).toBe('true')
    wrap.unmount()
  })
})
