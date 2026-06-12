import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisEventCalendar } from './index'
import type { CalendarConfig } from '../core'

const config = (): CalendarConfig => ({
  initialYear: 2025,
  initialMonth: 5, // June
  events: [
    { id: 'e1', title: 'Sprint Review', date: '2025-06-15', color: '#6366f1' },
    { id: 'e2', title: 'Team Lunch', date: '2025-06-15' },
    { id: 'e3', title: 'Deploy', date: '2025-06-20' },
  ],
})

describe('IrisEventCalendar (vue)', () => {
  it('renders the calendar root', () => {
    const wrapper = mount(IrisEventCalendar, { props: { config: config() } })
    expect(wrapper.find('[data-iris-event-calendar]').exists()).toBe(true)
  })

  it('renders month title containing the year', () => {
    const wrapper = mount(IrisEventCalendar, { props: { config: config() } })
    const title = wrapper.find('[data-iris-event-cal-title]')
    expect(title.text()).toContain('2025')
  })

  it('renders 7 weekday headers', () => {
    const wrapper = mount(IrisEventCalendar, { props: { config: config() } })
    expect(wrapper.findAll('[data-iris-event-cal-weekday]')).toHaveLength(7)
  })

  it('renders 42 day cells (6 × 7 grid)', () => {
    const wrapper = mount(IrisEventCalendar, { props: { config: config() } })
    expect(wrapper.findAll('[data-iris-event-cal-day]')).toHaveLength(42)
  })

  it('renders event chips on the correct day cell', () => {
    const wrapper = mount(IrisEventCalendar, { props: { config: config() } })
    const cell = wrapper.find('[data-iris-event-cal-day="2025-06-15"]')
    expect(cell.findAll('[data-iris-event-cal-chip]')).toHaveLength(2)
  })

  it('prev button navigates to previous month', async () => {
    const wrapper = mount(IrisEventCalendar, { props: { config: config() } })
    const before = wrapper.find('[data-iris-event-cal-title]').text()
    await wrapper.find('[data-iris-event-cal-prev]').trigger('click')
    const after = wrapper.find('[data-iris-event-cal-title]').text()
    // Title should change (moved to May) and still contain year
    expect(after).not.toBe(before)
    expect(after).toContain('2025')
    // May 1 should now be present in the grid
    expect(wrapper.find('[data-iris-event-cal-day="2025-05-01"]').exists()).toBe(true)
  })

  it('next button navigates to next month', async () => {
    const wrapper = mount(IrisEventCalendar, { props: { config: config() } })
    const before = wrapper.find('[data-iris-event-cal-title]').text()
    await wrapper.find('[data-iris-event-cal-next]').trigger('click')
    const after = wrapper.find('[data-iris-event-cal-title]').text()
    // Title should change (moved to July) and still contain year
    expect(after).not.toBe(before)
    expect(after).toContain('2025')
    // July 1 should now be present in the grid
    expect(wrapper.find('[data-iris-event-cal-day="2025-07-01"]').exists()).toBe(true)
  })

  it('clicking a day fires onDateClick', async () => {
    const onDateClick = vi.fn()
    const cfg = { ...config(), onDateClick }
    const wrapper = mount(IrisEventCalendar, { props: { config: cfg } })
    await wrapper.find('[data-iris-event-cal-day="2025-06-10"]').trigger('click')
    expect(onDateClick).toHaveBeenCalledWith('2025-06-10')
  })

  it('clicking an event chip fires onEventClick', async () => {
    const onEventClick = vi.fn()
    const cfg = { ...config(), onEventClick }
    const wrapper = mount(IrisEventCalendar, { props: { config: cfg } })
    await wrapper.find('[data-iris-event-cal-chip="e1"]').trigger('click')
    expect(onEventClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e1', title: 'Sprint Review' }),
    )
  })
})
