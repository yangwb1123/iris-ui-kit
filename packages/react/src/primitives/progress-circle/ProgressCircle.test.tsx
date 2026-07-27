import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisProgressCircle } from './ProgressCircle'

afterEach(() => cleanup())

const pb = (c: HTMLElement) => c.querySelector('[role="progressbar"]')
const ring = (c: HTMLElement) => c.querySelector('[data-iris-progress-circle-value]')
const label = (c: HTMLElement) => c.querySelector('[data-iris-progress-circle-label]')

describe('@iris-ui-kit/react IrisProgressCircle', () => {
  it('exposes progressbar aria values', () => {
    const { container } = render(<IrisProgressCircle value={50} />)
    expect(pb(container)?.getAttribute('aria-valuenow')).toBe('50')
    expect(pb(container)?.getAttribute('aria-valuemax')).toBe('100')
    expect(pb(container)?.getAttribute('aria-valuetext')).toBe('50%')
  })

  it('shows the percent label', () => {
    const { container } = render(<IrisProgressCircle value={42} />)
    expect(label(container)?.textContent).toBe('42%')
  })

  it('full value sets the dash offset to 0', () => {
    const { container } = render(<IrisProgressCircle value={100} />)
    expect(ring(container)?.getAttribute('stroke-dashoffset')).toBe('0')
  })

  it('zero value sets the dash offset to the full circumference', () => {
    const { container } = render(<IrisProgressCircle value={0} />)
    const dasharray = ring(container)?.getAttribute('stroke-dasharray')
    expect(ring(container)?.getAttribute('stroke-dashoffset')).toBe(dasharray)
  })

  it('showLabel=false hides the label', () => {
    const { container } = render(<IrisProgressCircle value={50} showLabel={false} />)
    expect(label(container)).toBeNull()
  })

  it('format customizes the label; status sets the data attr', () => {
    const { container } = render(
      <IrisProgressCircle value={50} status="success" format={(p) => `${p}/100`} />,
    )
    expect(label(container)?.textContent).toBe('50/100')
    expect(
      container.querySelector('[data-iris-progress-circle]')?.getAttribute('data-status'),
    ).toBe('success')
  })

  it('size prop sets the SVG dimension', () => {
    const { container } = render(<IrisProgressCircle value={50} size={200} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('200')
    expect(svg?.getAttribute('height')).toBe('200')
  })
})
