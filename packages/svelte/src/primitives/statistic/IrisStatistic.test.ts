import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisStatistic from './IrisStatistic.svelte'

afterEach(cleanup)

describe('@iris-ui/svelte IrisStatistic', () => {
  it('renders value', () => {
    const { container } = render(IrisStatistic, { props: { value: 1234 } })
    expect(container.querySelector('[data-iris-statistic-number]')!.textContent).toBe('1234')
  })

  it('renders label when provided', () => {
    const { container } = render(IrisStatistic, { props: { label: 'Revenue', value: 0 } })
    expect(container.querySelector('[data-iris-statistic-label]')!.textContent).toContain('Revenue')
  })

  it('renders prefix and suffix', () => {
    const { container } = render(IrisStatistic, {
      props: { value: 100, prefix: '$', suffix: 'k' },
    })
    expect(container.querySelector('[data-iris-statistic-prefix]')!.textContent).toBe('$')
    expect(container.querySelector('[data-iris-statistic-suffix]')!.textContent).toBe('k')
  })

  it('renders trend arrow when trend=up', () => {
    const { container } = render(IrisStatistic, {
      props: { value: 42, trend: 'up', trendValue: '+5%' },
    })
    expect(container.querySelector('[data-iris-statistic-trend]')).not.toBeNull()
    expect(container.querySelector('[data-iris-statistic-trend-value]')!.textContent).toBe('+5%')
  })

  it('does not render trend section when omitted', () => {
    const { container } = render(IrisStatistic, { props: { value: 0 } })
    expect(container.querySelector('[data-iris-statistic-trend]')).toBeNull()
  })
})
