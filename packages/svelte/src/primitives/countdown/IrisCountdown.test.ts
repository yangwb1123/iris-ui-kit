import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import IrisCountdown from './IrisCountdown.svelte'

describe('IrisCountdown', () => {
  it('renders countdown time element', () => {
    const future = Date.now() + 3600000 // 1 hour from now
    const { container } = render(IrisCountdown, { props: { value: future } })
    const el = container.querySelector('[data-iris-countdown]')
    expect(el).toBeTruthy()
    const time = container.querySelector('[data-iris-countdown-time]')
    expect(time).toBeTruthy()
  })

  it('shows finished state when target is in the past', () => {
    const past = Date.now() - 1000
    const { container } = render(IrisCountdown, { props: { value: past } })
    const el = container.querySelector('[data-iris-countdown]')
    expect(el!.getAttribute('data-finished')).toBe('true')
  })
})
