import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisRating } from './IrisRating'

afterEach(cleanup)

describe('IrisRating', () => {
  it('renders 5 stars by default', () => {
    const { container } = render(() => <IrisRating />)
    expect(container.querySelectorAll('[data-iris-rating-star]').length).toBe(5)
  })

  it('renders custom max stars', () => {
    const { container } = render(() => <IrisRating max={10} />)
    expect(container.querySelectorAll('[data-iris-rating-star]').length).toBe(10)
  })

  it('calls onChange when star is clicked', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisRating onChange={onChange} />)
    const stars = container.querySelectorAll('[data-iris-rating-star]')
    fireEvent.click(stars[2] as HTMLElement)
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('has slider aria role', () => {
    const { container } = render(() => <IrisRating value={3} max={5} />)
    const el = container.querySelector('[data-iris-rating]')!
    expect(el.getAttribute('role')).toBe('slider')
    expect(el.getAttribute('aria-valuenow')).toBe('3')
    expect(el.getAttribute('aria-valuemax')).toBe('5')
  })

  it('is not interactive when readonly', () => {
    const { container } = render(() => <IrisRating readonly />)
    const el = container.querySelector('[data-iris-rating]')!
    expect(el.getAttribute('aria-readonly')).toBe('true')
  })
})
