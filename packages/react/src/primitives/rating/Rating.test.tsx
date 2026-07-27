import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisRating } from './Rating'

afterEach(() => cleanup())

const stars = (c: HTMLElement) => c.querySelectorAll('[data-iris-rating-star]')
const root = (c: HTMLElement) => c.querySelector('[data-iris-rating]') as HTMLElement

describe('@iris-ui-kit/react IrisRating', () => {
  it('renders `max` stars (default 5)', () => {
    const { container } = render(<IrisRating />)
    expect(stars(container).length).toBe(5)
  })

  it('honors a custom max', () => {
    const { container } = render(<IrisRating max={10} />)
    expect(stars(container).length).toBe(10)
  })

  it('clicking a star sets the value', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisRating onValueChange={onValueChange} />)
    fireEvent.click(stars(container)[2])
    expect(onValueChange).toHaveBeenCalledWith(3)
  })

  it('clicking the current value clears it (clearable)', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisRating value={3} onValueChange={onValueChange} />)
    fireEvent.click(stars(container)[2])
    expect(onValueChange).toHaveBeenCalledWith(0)
  })

  it('clearable=false keeps the value when re-clicked', () => {
    const onValueChange = vi.fn()
    const { container } = render(
      <IrisRating value={3} clearable={false} onValueChange={onValueChange} />,
    )
    fireEvent.click(stars(container)[2])
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('readonly ignores clicks and is not focusable', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisRating value={2} readonly onValueChange={onValueChange} />)
    fireEvent.click(stars(container)[4])
    expect(onValueChange).not.toHaveBeenCalled()
    expect(root(container).getAttribute('tabindex')).toBe('-1')
    expect(root(container).getAttribute('aria-readonly')).toBe('true')
  })

  it('disabled ignores clicks', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisRating value={2} disabled onValueChange={onValueChange} />)
    fireEvent.click(stars(container)[4])
    expect(onValueChange).not.toHaveBeenCalled()
    expect(root(container).getAttribute('aria-disabled')).toBe('true')
  })

  it('keyboard: ArrowRight / ArrowLeft step the value', () => {
    const inc = vi.fn()
    const { container: c1 } = render(<IrisRating value={2} onValueChange={inc} />)
    fireEvent.keyDown(root(c1), { key: 'ArrowRight' })
    expect(inc).toHaveBeenCalledWith(3)
    const dec = vi.fn()
    const { container: c2 } = render(<IrisRating value={2} onValueChange={dec} />)
    fireEvent.keyDown(root(c2), { key: 'ArrowLeft' })
    expect(dec).toHaveBeenCalledWith(1)
  })

  it('keyboard: Home → 0, End → max', () => {
    const home = vi.fn()
    const { container: c1 } = render(<IrisRating value={3} onValueChange={home} />)
    fireEvent.keyDown(root(c1), { key: 'Home' })
    expect(home).toHaveBeenCalledWith(0)
    const end = vi.fn()
    const { container: c2 } = render(<IrisRating value={3} max={5} onValueChange={end} />)
    fireEvent.keyDown(root(c2), { key: 'End' })
    expect(end).toHaveBeenCalledWith(5)
  })

  it('allowHalf steps by 0.5', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisRating value={2} allowHalf onValueChange={onValueChange} />)
    fireEvent.keyDown(root(container), { key: 'ArrowRight' })
    expect(onValueChange).toHaveBeenCalledWith(2.5)
  })

  it('marks filled and half stars', () => {
    const { container } = render(<IrisRating value={2.5} allowHalf />)
    const s = stars(container)
    expect(s[0].getAttribute('data-filled')).toBe('true')
    expect(s[1].getAttribute('data-filled')).toBe('true')
    expect(s[2].getAttribute('data-filled')).toBe('half')
    expect(s[3].getAttribute('data-filled')).toBeNull()
  })

  it('a11y: slider role, value attrs, valuetext, id, aria-invalid', () => {
    const { container } = render(<IrisRating value={2} max={5} id="rate" invalid />)
    const el = root(container)
    expect(el.getAttribute('role')).toBe('slider')
    expect(el.getAttribute('aria-valuemin')).toBe('0')
    expect(el.getAttribute('aria-valuemax')).toBe('5')
    expect(el.getAttribute('aria-valuenow')).toBe('2')
    expect(el.getAttribute('aria-valuetext')).toBe('2 of 5')
    expect(el.id).toBe('rate')
    expect(el.getAttribute('aria-invalid')).toBe('true')
  })
})
