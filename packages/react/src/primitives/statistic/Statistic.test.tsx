import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisStatistic } from './Statistic'

afterEach(() => cleanup())

describe('@iris-ui-kit/react IrisStatistic', () => {
  it('renders the value and label', () => {
    const { container } = render(<IrisStatistic label="Revenue" value="1,234" />)
    expect(container.querySelector('[data-iris-statistic-number]')?.textContent).toBe('1,234')
    expect(container.querySelector('[data-iris-statistic-label]')?.textContent).toBe('Revenue')
  })

  it('renders prefix and suffix', () => {
    const { container } = render(<IrisStatistic value={42} prefix="$" suffix="USD" />)
    expect(container.querySelector('[data-iris-statistic-prefix]')?.textContent).toBe('$')
    expect(container.querySelector('[data-iris-statistic-suffix]')?.textContent).toBe('USD')
  })

  it('shows a trend with direction data + value + glyph', () => {
    const { container } = render(<IrisStatistic value={42} trend="up" trendValue="12%" />)
    expect(container.querySelector('[data-iris-statistic]')?.getAttribute('data-trend')).toBe('up')
    expect(container.querySelector('[data-iris-statistic-trend-value]')?.textContent).toBe('12%')
    expect(container.querySelector('[data-iris-statistic-trend]')?.textContent).toContain('▲')
  })

  it('renders a description', () => {
    const { container } = render(<IrisStatistic value={1} description="since last week" />)
    expect(container.querySelector('[data-iris-statistic-desc]')?.textContent).toBe(
      'since last week',
    )
  })

  it('omits optional parts when not provided', () => {
    const { container } = render(<IrisStatistic value={1} />)
    expect(container.querySelector('[data-iris-statistic-label]')).toBeNull()
    expect(container.querySelector('[data-iris-statistic-trend]')).toBeNull()
  })
})
