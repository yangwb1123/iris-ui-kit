import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisGauge } from './Gauge'

afterEach(() => cleanup())

const meter = (c: HTMLElement) => c.querySelector('[role="meter"]')
const arc = (c: HTMLElement) => c.querySelector('[data-iris-gauge-value]')
const label = (c: HTMLElement) => c.querySelector('[data-iris-gauge-label]')

describe('@iris-ui/react IrisGauge', () => {
  it('exposes meter aria values', () => {
    const { container } = render(<IrisGauge value={50} />)
    expect(meter(container)?.getAttribute('aria-valuenow')).toBe('50')
    expect(meter(container)?.getAttribute('aria-valuemin')).toBe('0')
    expect(meter(container)?.getAttribute('aria-valuemax')).toBe('100')
    expect(meter(container)?.getAttribute('aria-valuetext')).toBe('50%')
  })

  it('shows the percent label', () => {
    const { container } = render(<IrisGauge value={25} />)
    expect(label(container)?.textContent).toBe('25%')
  })

  it('full value sets the dash offset to 0', () => {
    const { container } = render(<IrisGauge value={100} />)
    expect(arc(container)?.getAttribute('stroke-dashoffset')).toBe('0')
  })

  it('empty value sets the dash offset to the arc length', () => {
    const { container } = render(<IrisGauge value={0} />)
    expect(arc(container)?.getAttribute('stroke-dashoffset')).toBe(
      arc(container)?.getAttribute('stroke-dasharray'),
    )
  })

  it('respects the min/max range', () => {
    const { container } = render(<IrisGauge value={5} min={0} max={10} />)
    expect(label(container)?.textContent).toBe('50%')
  })

  it('showValue=false hides the label; status sets the data attr', () => {
    const { container } = render(<IrisGauge value={50} status="danger" showValue={false} />)
    expect(label(container)).toBeNull()
    expect(meter(container)?.getAttribute('data-status')).toBe('danger')
  })
})
