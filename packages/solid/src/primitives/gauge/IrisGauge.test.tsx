import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisGauge } from './IrisGauge'

afterEach(cleanup)

describe('IrisGauge', () => {
  it('renders with correct aria attributes', () => {
    const { container } = render(() => <IrisGauge value={60} min={0} max={100} />)
    const el = container.querySelector('[data-iris-gauge]')!
    expect(el.getAttribute('role')).toBe('meter')
    expect(el.getAttribute('aria-valuenow')).toBe('60')
    expect(el.getAttribute('aria-valuemin')).toBe('0')
    expect(el.getAttribute('aria-valuemax')).toBe('100')
  })

  it('shows percent label', () => {
    const { getByText } = render(() => <IrisGauge value={50} />)
    expect(getByText('50%')).toBeTruthy()
  })

  it('uses custom format', () => {
    const { getByText } = render(() => <IrisGauge value={75} format={(v) => `${v}°C`} />)
    expect(getByText('75°C')).toBeTruthy()
  })
})
