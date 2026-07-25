import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import IrisCountdown from './IrisCountdown.svelte'

describe('IrisCountdown', () => {
  it('renders countdown element', () => {
    const future = Date.now() + 3600000
    const { container } = render(IrisCountdown, { props: { value: future } })
    const el = container.querySelector('[data-iris-countdown]')
    expect(el).toBeTruthy()
  })

  it('shows finished state when target is in the past', () => {
    const past = Date.now() - 1000
    const { container } = render(IrisCountdown, { props: { value: past } })
    const el = container.querySelector('[data-iris-countdown]')
    expect(el!.getAttribute('data-finished')).toBe('true')
  })

  it('displays formatted time', () => {
    const future = Date.now() + 3661000
    const { container } = render(IrisCountdown, { props: { value: future, format: 'HH:mm:ss' } })
    const time = container.querySelector('[data-iris-countdown-value]')
    expect(time?.textContent).toMatch(/\d{2}:\d{2}:\d{2}/)
  })

  it('accepts title prop', () => {
    const future = Date.now() + 3600000
    const { container } = render(IrisCountdown, {
      props: { value: future, title: 'Time remaining' },
    })
    const title = container.querySelector('[data-iris-countdown-title]')
    expect(title?.textContent).toBe('Time remaining')
  })

  it('accepts prefix and suffix', () => {
    const future = Date.now() + 3600000
    const { container } = render(IrisCountdown, {
      props: { value: future, prefix: '⏱', suffix: 'left' },
    })
    expect(container.textContent).toContain('⏱')
    expect(container.textContent).toContain('left')
  })

  it('custom class is forwarded', () => {
    const future = Date.now() + 3600000
    const { container } = render(IrisCountdown, {
      props: { value: future, class: 'my-countdown' },
    })
    const el = container.querySelector('[data-iris-countdown]')
    expect(el?.className).toContain('my-countdown')
  })
})
