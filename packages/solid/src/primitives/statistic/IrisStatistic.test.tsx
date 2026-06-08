import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisStatistic } from './IrisStatistic'

afterEach(cleanup)

describe('IrisStatistic', () => {
  it('renders label and value', () => {
    const { getByText } = render(() => <IrisStatistic label="Revenue" value="$12,400" />)
    expect(getByText('Revenue')).toBeTruthy()
    expect(getByText('$12,400')).toBeTruthy()
  })

  it('renders prefix and suffix', () => {
    const { container } = render(() => <IrisStatistic value="42" prefix="$" suffix="k" />)
    expect(container.querySelector('[data-iris-statistic-prefix]')?.textContent).toBe('$')
    expect(container.querySelector('[data-iris-statistic-suffix]')?.textContent).toBe('k')
  })

  it('renders up trend arrow', () => {
    const { container } = render(() => <IrisStatistic value="100" trend="up" trendValue="+5%" />)
    const trendEl = container.querySelector('[data-iris-statistic-trend]')
    expect(trendEl?.textContent).toContain('▲')
    expect(trendEl?.textContent).toContain('+5%')
  })

  it('renders description', () => {
    const { getByText } = render(() => <IrisStatistic value="99" description="vs last month" />)
    expect(getByText('vs last month')).toBeTruthy()
  })

  it('renders without optional props', () => {
    const { container } = render(() => <IrisStatistic value="42" />)
    expect(container.querySelector('[data-iris-statistic]')).not.toBeNull()
  })
})
