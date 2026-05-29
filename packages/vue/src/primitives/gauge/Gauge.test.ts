import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisGauge } from './Gauge'

const meter = (w: ReturnType<typeof mount>) => w.find('[role="meter"]')
const arc = (w: ReturnType<typeof mount>) => w.find('[data-iris-gauge-value]')
const label = (w: ReturnType<typeof mount>) => w.find('[data-iris-gauge-label]')

describe('IrisGauge', () => {
  it('exposes meter aria values', () => {
    const w = mount(IrisGauge, { props: { value: 50 } })
    expect(meter(w).attributes('aria-valuenow')).toBe('50')
    expect(meter(w).attributes('aria-valuemin')).toBe('0')
    expect(meter(w).attributes('aria-valuemax')).toBe('100')
    expect(meter(w).attributes('aria-valuetext')).toBe('50%')
  })

  it('shows the percent label', () => {
    const w = mount(IrisGauge, { props: { value: 25 } })
    expect(label(w).text()).toBe('25%')
  })

  it('full value sets the dash offset to 0', () => {
    const w = mount(IrisGauge, { props: { value: 100 } })
    expect(arc(w).attributes('stroke-dashoffset')).toBe('0')
  })

  it('empty value sets the dash offset to the arc length', () => {
    const w = mount(IrisGauge, { props: { value: 0 } })
    expect(arc(w).attributes('stroke-dashoffset')).toBe(arc(w).attributes('stroke-dasharray'))
  })

  it('respects the min/max range', () => {
    const w = mount(IrisGauge, { props: { value: 5, min: 0, max: 10 } })
    expect(label(w).text()).toBe('50%')
  })

  it('showValue=false hides the label; status sets the data attr', () => {
    const w = mount(IrisGauge, { props: { value: 50, status: 'danger', showValue: false } })
    expect(label(w).exists()).toBe(false)
    expect(meter(w).attributes('data-status')).toBe('danger')
  })
})
