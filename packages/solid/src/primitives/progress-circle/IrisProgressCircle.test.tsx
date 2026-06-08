import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisProgressCircle } from './IrisProgressCircle'

afterEach(cleanup)

describe('IrisProgressCircle', () => {
  it('renders with aria-valuenow', () => {
    const { container } = render(() => <IrisProgressCircle value={75} max={100} />)
    const el = container.querySelector('[data-iris-progress-circle]')!
    expect(el.getAttribute('aria-valuenow')).toBe('75')
  })

  it('renders percent label', () => {
    const { getByText } = render(() => <IrisProgressCircle value={50} />)
    expect(getByText('50%')).toBeTruthy()
  })

  it('uses custom format', () => {
    const { getByText } = render(() => <IrisProgressCircle value={80} format={(p) => `${p} pts`} />)
    expect(getByText('80 pts')).toBeTruthy()
  })

  it('hides label when showLabel=false', () => {
    const { container } = render(() => <IrisProgressCircle value={60} showLabel={false} />)
    expect(container.querySelector('[data-iris-progress-circle-label]')).toBeNull()
  })
})
