import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import IrisGauge from './IrisGauge.svelte'

describe('IrisGauge', () => {
  it('renders a gauge with value', () => {
    const { container } = render(IrisGauge, { props: { value: 60 } })
    const el = container.querySelector('[data-iris-gauge]')
    expect(el).toBeTruthy()
    expect(el!.getAttribute('aria-valuenow')).toBe('60')
  })

  it('shows percent label by default', () => {
    const { container } = render(IrisGauge, { props: { value: 50, min: 0, max: 100 } })
    const label = container.querySelector('[data-iris-gauge-label]')
    expect(label!.textContent).toBe('50%')
  })
})
