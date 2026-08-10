import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisCalendar } from './Calendar'
import { IrisI18nProvider } from '../../i18n'
import {
  addDays,
  buildMonthMatrix,
  formatMonthYear,
  getWeekdayNames,
  isOutOfRange,
  isSameDay,
} from './dateUtils'

afterEach(() => vi.useRealTimers())

describe('@iris-ui-kit/vue dateUtils', () => {
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

describe('@iris-ui-kit/vue IrisCalendar', () => {
  it('renders header + weekday row + 42-cell grid', () => {
    const wrap = mount(IrisCalendar, {
      props: { defaultMonth: new Date(2024, 2, 15) },
    })
    expect(wrap.find('[data-iris-calendar-header]').exists()).toBe(true)
    expect(wrap.findAll('[role=columnheader]').length).toBe(7)
    expect(wrap.findAll('[data-iris-calendar-day]').length).toBe(42)
  })

  it('grid has 6 direct child role=row rows and full-date cell labels', () => {
    const wrap = mount(IrisCalendar, {
      props: { defaultMonth: new Date(2024, 5, 15), locale: 'en-US' },
    })
    const grid = wrap.find('[data-iris-calendar-grid]')
    const rows = grid.element.querySelectorAll(':scope > [role=row]')
    expect(rows.length).toBe(6)
    // Each day button announces the whole date, not just the day number.
    const cell = wrap.find('[data-iris-calendar-day-iso="2024-06-10"]')
    expect(cell.attributes('aria-label')).toMatch(/Monday, June 10, 2024/)
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

  it('nav aria-labels default to English and localize via IrisI18nProvider', () => {
    const plain = mount(IrisCalendar, { props: { defaultMonth: new Date(2024, 5, 15) } })
    expect(plain.find('[data-iris-calendar-prev]').attributes('aria-label')).toBe('Previous month')
    expect(plain.find('[data-iris-calendar-next]').attributes('aria-label')).toBe('Next month')

    const localized = mount(
      defineComponent({
        setup: () => () =>
          h(
            IrisI18nProvider,
            {
              messages: {
                'calendar.previousMonth': 'Mois précédent',
                'calendar.nextMonth': 'Mois suivant',
              },
            },
            { default: () => h(IrisCalendar, { defaultMonth: new Date(2024, 5, 15) }) },
          ),
      }),
    )
    expect(localized.find('[data-iris-calendar-prev]').attributes('aria-label')).toBe(
      'Mois précédent',
    )
    expect(localized.find('[data-iris-calendar-next]').attributes('aria-label')).toBe(
      'Mois suivant',
    )
  })

  it('disabled prop disables all day cells', () => {
    const wrap = mount(IrisCalendar, {
      props: { defaultMonth: new Date(2024, 5, 1), disabled: true },
    })
    const cells = wrap.findAll('[data-iris-calendar-day]')
    expect(cells.every((c) => (c.element as HTMLButtonElement).disabled)).toBe(true)
  })

  describe('grid roving semantics (sunk to core createCalendarNav)', () => {
    // The seeded `modelValue` is also the roving focus; on that cell `selected`
    // wins over `focused` in data-state, so focus is asserted via `tabindex`.
    const bounds = {
      defaultMonth: new Date(2024, 5, 1),
      min: new Date(2024, 5, 10),
      max: new Date(2024, 6, 20),
      locale: 'en-US',
    }
    const key = async (wrap: ReturnType<typeof mount>, k: string) => {
      await wrap.find('[data-iris-calendar-grid]').trigger('keydown', { key: k })
      await nextTick()
    }

    it('ArrowRight at a row end stays (no wrap, no month flip)', async () => {
      const wrap = mount(IrisCalendar, {
        props: { modelValue: new Date(2024, 5, 15), ...bounds },
      })
      await key(wrap, 'ArrowRight')
      expect(wrap.find('[data-iris-calendar-day-iso="2024-06-15"]').attributes('tabindex')).toBe(
        '0',
      )
      expect(wrap.find('[data-iris-calendar-day-iso="2024-06-16"]').attributes('tabindex')).toBe(
        '-1',
      )
      expect(wrap.find('[data-iris-calendar-title]').text()).toMatch(/June 2024/)
    })

    it('ArrowLeft blocked by a disabled cell stays', async () => {
      const wrap = mount(IrisCalendar, {
        props: { modelValue: new Date(2024, 5, 10), ...bounds },
      })
      await key(wrap, 'ArrowLeft')
      expect(wrap.find('[data-iris-calendar-day-iso="2024-06-10"]').attributes('tabindex')).toBe(
        '0',
      )
      expect(wrap.find('[data-iris-calendar-day-iso="2024-06-11"]').attributes('tabindex')).toBe(
        '-1',
      )
    })

    it('Home skips disabled cells to the nearest enabled row start', async () => {
      const wrap = mount(IrisCalendar, {
        props: { modelValue: new Date(2024, 5, 11), ...bounds },
      })
      await key(wrap, 'Home')
      expect(wrap.find('[data-iris-calendar-day-iso="2024-06-10"]').attributes('tabindex')).toBe(
        '0',
      )
    })

    it('ArrowUp skips a fully-disabled column segment (stays, no clamp-jump)', async () => {
      const wrap = mount(IrisCalendar, {
        props: { modelValue: new Date(2024, 5, 12), ...bounds },
      })
      await key(wrap, 'ArrowUp')
      expect(wrap.find('[data-iris-calendar-day-iso="2024-06-12"]').attributes('tabindex')).toBe(
        '0',
      )
      expect(wrap.find('[data-iris-calendar-day-iso="2024-06-10"]').attributes('tabindex')).toBe(
        '-1',
      )
    })
  })
})
