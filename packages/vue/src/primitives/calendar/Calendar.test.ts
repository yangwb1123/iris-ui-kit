import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisCalendar } from './Calendar'
import {
  addDays,
  buildMonthMatrix,
  formatMonthYear,
  getWeekdayNames,
  isOutOfRange,
  isSameDay,
} from './dateUtils'

afterEach(() => vi.useRealTimers())

describe('@iris-ui/vue dateUtils', () => {
  it('buildMonthMatrix returns 6x7 grid with leading/trailing days', () => {
    // March 2024 starts on Friday. weekStartsOn=0 (Sunday) → 5 leading days.
    const matrix = buildMonthMatrix(new Date(2024, 2, 15), 0)
    expect(matrix.length).toBe(6)
    expect(matrix.every((r) => r.length === 7)).toBe(true)
    // First cell should be Feb 25, 2024 (Sunday).
    expect(matrix[0]![0]!.getMonth()).toBe(1)
    expect(matrix[0]![0]!.getDate()).toBe(25)
  })

  it('weekStartsOn=1 shifts grid to start on Monday', () => {
    const matrix = buildMonthMatrix(new Date(2024, 2, 15), 1)
    // March 2024 starts on Friday. From Monday, leading = 4 days (Mon, Tue, Wed, Thu).
    expect(matrix[0]![0]!.getDate()).toBe(26)
  })

  it('formatMonthYear returns localized month + year', () => {
    expect(formatMonthYear(new Date(2024, 0, 1), 'en-US')).toMatch(/January.*2024/)
  })

  it('getWeekdayNames returns 7 names', () => {
    expect(getWeekdayNames(0, 'en-US').length).toBe(7)
  })

  it('isOutOfRange respects min and max', () => {
    const min = new Date(2024, 0, 10)
    const max = new Date(2024, 0, 20)
    expect(isOutOfRange(new Date(2024, 0, 5), min, max)).toBe(true)
    expect(isOutOfRange(new Date(2024, 0, 15), min, max)).toBe(false)
    expect(isOutOfRange(new Date(2024, 0, 25), min, max)).toBe(true)
  })

  it('isSameDay handles different times same day', () => {
    expect(isSameDay(new Date(2024, 0, 1, 8), new Date(2024, 0, 1, 20))).toBe(true)
  })

  it('addDays handles month/year rollover', () => {
    expect(addDays(new Date(2024, 0, 31), 1).getMonth()).toBe(1)
  })
})

describe('@iris-ui/vue IrisCalendar', () => {
  it('renders header + weekday row + 42-cell grid', () => {
    const wrap = mount(IrisCalendar, {
      props: { defaultMonth: new Date(2024, 2, 15) },
    })
    expect(wrap.find('[data-iris-calendar-header]').exists()).toBe(true)
    expect(wrap.findAll('[role=columnheader]').length).toBe(7)
    expect(wrap.findAll('[data-iris-calendar-day]').length).toBe(42)
  })

  it('header title reflects visible month', () => {
    const wrap = mount(IrisCalendar, {
      props: { defaultMonth: new Date(2024, 5, 15), locale: 'en-US' },
    })
    expect(wrap.find('[data-iris-calendar-title]').text()).toMatch(/June.*2024/)
  })

  it('prev/next buttons change the visible month', async () => {
    const wrap = mount(IrisCalendar, {
      props: { defaultMonth: new Date(2024, 5, 15), locale: 'en-US' },
    })
    await wrap.find('[data-iris-calendar-next]').trigger('click')
    expect(wrap.find('[data-iris-calendar-title]').text()).toMatch(/July.*2024/)
    await wrap.find('[data-iris-calendar-prev]').trigger('click')
    await wrap.find('[data-iris-calendar-prev]').trigger('click')
    expect(wrap.find('[data-iris-calendar-title]').text()).toMatch(/May.*2024/)
  })

  it('clicking a day emits update:modelValue with that date', async () => {
    const wrap = mount(IrisCalendar, {
      props: { defaultMonth: new Date(2024, 5, 15) },
    })
    const target = wrap.find('[data-iris-calendar-day-iso="2024-06-10"]')
    await target.trigger('click')
    const emitted = wrap.emitted('update:modelValue')!
    expect(emitted.length).toBe(1)
    const date = emitted[0]![0] as Date
    expect(isSameDay(date, new Date(2024, 5, 10))).toBe(true)
  })

  it('selected date carries aria-selected="true"', () => {
    const wrap = mount(IrisCalendar, {
      props: {
        modelValue: new Date(2024, 5, 10),
        defaultMonth: new Date(2024, 5, 1),
      },
    })
    const sel = wrap.find('[data-iris-calendar-day-iso="2024-06-10"]')
    expect(sel.attributes('aria-selected')).toBe('true')
  })

  it('out-of-range dates are disabled and not clickable', async () => {
    const wrap = mount(IrisCalendar, {
      props: {
        defaultMonth: new Date(2024, 5, 1),
        min: new Date(2024, 5, 5),
        max: new Date(2024, 5, 20),
      },
    })
    const cell = wrap.find('[data-iris-calendar-day-iso="2024-06-03"]')
    expect((cell.element as HTMLButtonElement).disabled).toBe(true)
    await cell.trigger('click')
    expect(wrap.emitted('update:modelValue')).toBeUndefined()
  })

  it('today gets aria-current="date"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 5, 15))
    const wrap = mount(IrisCalendar, {
      props: { defaultMonth: new Date(2024, 5, 1) },
    })
    const today = wrap.find('[data-iris-calendar-day-iso="2024-06-15"]')
    expect(today.attributes('aria-current')).toBe('date')
  })

  it('ArrowRight on grid moves focus +1 day', async () => {
    const wrap = mount(IrisCalendar, {
      props: {
        modelValue: new Date(2024, 5, 10),
        defaultMonth: new Date(2024, 5, 1),
      },
    })
    await wrap.find('[data-iris-calendar-grid]').trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    const focused = wrap.find('[data-state=focused]')
    expect(focused.attributes('data-iris-calendar-day-iso')).toBe('2024-06-11')
  })

  it('ArrowDown moves focus +7 days', async () => {
    const wrap = mount(IrisCalendar, {
      props: {
        modelValue: new Date(2024, 5, 10),
        defaultMonth: new Date(2024, 5, 1),
      },
    })
    await wrap.find('[data-iris-calendar-grid]').trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    const focused = wrap.find('[data-state=focused]')
    expect(focused.attributes('data-iris-calendar-day-iso')).toBe('2024-06-17')
  })

  it('PageDown moves visible month forward', async () => {
    const wrap = mount(IrisCalendar, {
      props: { defaultMonth: new Date(2024, 5, 15), locale: 'en-US' },
    })
    await wrap.find('[data-iris-calendar-grid]').trigger('keydown', { key: 'PageDown' })
    await nextTick()
    expect(wrap.find('[data-iris-calendar-title]').text()).toMatch(/July.*2024/)
  })

  it('Enter on grid selects the focused date', async () => {
    const wrap = mount(IrisCalendar, {
      props: {
        modelValue: new Date(2024, 5, 10),
        defaultMonth: new Date(2024, 5, 1),
      },
    })
    await wrap.find('[data-iris-calendar-grid]').trigger('keydown', { key: 'Enter' })
    const emit = wrap.emitted('update:modelValue')
    expect(emit).toBeTruthy()
    expect(isSameDay(emit![0]![0] as Date, new Date(2024, 5, 10))).toBe(true)
  })

  it('prev button disabled when visible month <= min month', () => {
    const wrap = mount(IrisCalendar, {
      props: {
        defaultMonth: new Date(2024, 5, 1),
        min: new Date(2024, 5, 5),
      },
    })
    expect((wrap.find('[data-iris-calendar-prev]').element as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('disabled prop disables all day cells', () => {
    const wrap = mount(IrisCalendar, {
      props: { defaultMonth: new Date(2024, 5, 1), disabled: true },
    })
    const cells = wrap.findAll('[data-iris-calendar-day]')
    expect(cells.every((c) => (c.element as HTMLButtonElement).disabled)).toBe(true)
  })
})
