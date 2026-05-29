import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisProgressCircle } from './ProgressCircle'

const pb = (w: ReturnType<typeof mount>) => w.find('[role="progressbar"]')
const ring = (w: ReturnType<typeof mount>) => w.find('[data-iris-progress-circle-value]')
const label = (w: ReturnType<typeof mount>) => w.find('[data-iris-progress-circle-label]')

describe('IrisProgressCircle', () => {
  it('exposes progressbar aria values', () => {
    const w = mount(IrisProgressCircle, { props: { value: 50 } })
    expect(pb(w).attributes('aria-valuenow')).toBe('50')
    expect(pb(w).attributes('aria-valuemax')).toBe('100')
    expect(pb(w).attributes('aria-valuetext')).toBe('50%')
  })

  it('shows the percent label', () => {
    const w = mount(IrisProgressCircle, { props: { value: 42 } })
    expect(label(w).text()).toBe('42%')
  })

  it('full value sets the dash offset to 0', () => {
    const w = mount(IrisProgressCircle, { props: { value: 100 } })
    expect(ring(w).attributes('stroke-dashoffset')).toBe('0')
  })

  it('zero value sets the dash offset to the full circumference', () => {
    const w = mount(IrisProgressCircle, { props: { value: 0 } })
    expect(ring(w).attributes('stroke-dashoffset')).toBe(ring(w).attributes('stroke-dasharray'))
  })

  it('showLabel=false hides the label', () => {
    const w = mount(IrisProgressCircle, { props: { value: 50, showLabel: false } })
    expect(label(w).exists()).toBe(false)
  })

  it('format customizes the label; status sets the data attr', () => {
    const w = mount(IrisProgressCircle, {
      props: { value: 50, status: 'success', format: (p: number) => `${p}/100` },
    })
    expect(label(w).text()).toBe('50/100')
    expect(w.find('[data-iris-progress-circle]').attributes('data-status')).toBe('success')
  })
})
