import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisStatistic } from './Statistic'

describe('IrisStatistic', () => {
  it('renders the value and label', () => {
    const w = mount(IrisStatistic, { props: { label: 'Revenue', value: '1,234' } })
    expect(w.find('[data-iris-statistic-number]').text()).toBe('1,234')
    expect(w.find('[data-iris-statistic-label]').text()).toBe('Revenue')
  })

  it('renders prefix and suffix', () => {
    const w = mount(IrisStatistic, { props: { value: 42, prefix: '$', suffix: 'USD' } })
    expect(w.find('[data-iris-statistic-prefix]').text()).toBe('$')
    expect(w.find('[data-iris-statistic-suffix]').text()).toBe('USD')
  })

  it('shows a trend with direction data + value + glyph', () => {
    const w = mount(IrisStatistic, { props: { value: 42, trend: 'up', trendValue: '12%' } })
    expect(w.find('[data-iris-statistic]').attributes('data-trend')).toBe('up')
    expect(w.find('[data-iris-statistic-trend-value]').text()).toBe('12%')
    expect(w.find('[data-iris-statistic-trend]').text()).toContain('▲')
  })

  it('renders a description', () => {
    const w = mount(IrisStatistic, { props: { value: 1, description: 'since last week' } })
    expect(w.find('[data-iris-statistic-desc]').text()).toBe('since last week')
  })

  it('omits optional parts when not provided', () => {
    const w = mount(IrisStatistic, { props: { value: 1 } })
    expect(w.find('[data-iris-statistic-label]').exists()).toBe(false)
    expect(w.find('[data-iris-statistic-trend]').exists()).toBe(false)
  })
})
