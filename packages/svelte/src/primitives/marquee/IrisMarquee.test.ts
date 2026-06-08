import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisMarquee from './IrisMarquee.svelte'

afterEach(cleanup)

describe('IrisMarquee', () => {
  it('renders without crashing', () => {
    const { container } = render(IrisMarquee)
    expect(container).toBeTruthy()
  })

  it('renders the track element', () => {
    const { container } = render(IrisMarquee)
    expect(container.querySelector('[data-iris-marquee-track]')).not.toBeNull()
  })

  it('renders two content copies', () => {
    const { container } = render(IrisMarquee)
    expect(container.querySelectorAll('[data-iris-marquee-content]').length).toBe(2)
  })

  it('second copy is aria-hidden', () => {
    const { container } = render(IrisMarquee)
    const copies = container.querySelectorAll('[data-iris-marquee-content]')
    expect(copies[1].getAttribute('aria-hidden')).toBe('true')
  })
})
