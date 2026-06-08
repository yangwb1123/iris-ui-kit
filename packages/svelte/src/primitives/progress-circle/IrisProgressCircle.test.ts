import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import IrisProgressCircle from './IrisProgressCircle.svelte'

describe('IrisProgressCircle', () => {
  it('renders a circular progress with label', () => {
    const { container } = render(IrisProgressCircle, { props: { value: 75 } })
    const el = container.querySelector('[data-iris-progress-circle]')
    expect(el).toBeTruthy()
    expect(el!.getAttribute('aria-valuenow')).toBe('75')
    const label = container.querySelector('[data-iris-progress-circle-label]')
    expect(label!.textContent).toBe('75%')
  })

  it('can hide the label', () => {
    const { container } = render(IrisProgressCircle, { props: { value: 50, showLabel: false } })
    const label = container.querySelector('[data-iris-progress-circle-label]')
    expect(label).toBeFalsy()
  })
})
