import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisCarousel } from './Carousel'

afterEach(() => cleanup())

const ThreeSlides = (props: Record<string, unknown>) => (
  <IrisCarousel {...props}>
    <div>One</div>
    <div>Two</div>
    <div>Three</div>
  </IrisCarousel>
)

const slidesEls = (c: HTMLElement) => c.querySelectorAll('[data-iris-carousel-slide]')
const root = (c: HTMLElement) => c.querySelector('[data-iris-carousel]') as HTMLElement

describe('@iris-ui/react IrisCarousel', () => {
  it('renders one slide element per child', () => {
    const { container } = render(<ThreeSlides />)
    expect(slidesEls(container).length).toBe(3)
  })

  it('next / prev arrows change the index', () => {
    const onIndexChange = vi.fn()
    const { container } = render(<ThreeSlides onIndexChange={onIndexChange} />)
    fireEvent.click(container.querySelector('[data-iris-carousel-next]')!)
    expect(onIndexChange).toHaveBeenLastCalledWith(1)
  })

  it('renders an indicator per slide and jumps on click', () => {
    const onIndexChange = vi.fn()
    const { container } = render(<ThreeSlides onIndexChange={onIndexChange} />)
    const dots = container.querySelectorAll('[data-iris-carousel-indicator]')
    expect(dots.length).toBe(3)
    fireEvent.click(dots[2])
    expect(onIndexChange).toHaveBeenLastCalledWith(2)
  })

  it('loops: prev from the first slide wraps to the last', () => {
    const onIndexChange = vi.fn()
    const { container } = render(<ThreeSlides onIndexChange={onIndexChange} />)
    fireEvent.click(container.querySelector('[data-iris-carousel-prev]')!)
    expect(onIndexChange).toHaveBeenLastCalledWith(2)
  })

  it('loop=false clamps and disables arrows at the ends', () => {
    const onIndexChange = vi.fn()
    const { container } = render(<ThreeSlides loop={false} onIndexChange={onIndexChange} />)
    const prev = container.querySelector('[data-iris-carousel-prev]') as HTMLButtonElement
    expect(prev.disabled).toBe(true)
    fireEvent.click(prev)
    expect(onIndexChange).not.toHaveBeenCalled()
  })

  it('keyboard ArrowRight / ArrowLeft navigate', () => {
    const onIndexChange = vi.fn()
    const { container } = render(<ThreeSlides onIndexChange={onIndexChange} />)
    fireEvent.keyDown(root(container), { key: 'ArrowRight' })
    expect(onIndexChange).toHaveBeenLastCalledWith(1)
  })

  it('controlled index drives the track transform', () => {
    const { container } = render(<ThreeSlides index={1} />)
    const track = container.querySelector('[data-iris-carousel-track]') as HTMLElement
    expect(track.style.transform).toBe('translateX(-100%)')
  })

  it('a11y: carousel + slide roledescriptions; inactive slides are aria-hidden', () => {
    const { container } = render(<ThreeSlides ariaLabel="Gallery" />)
    expect(root(container).getAttribute('aria-roledescription')).toBe('carousel')
    expect(root(container).getAttribute('aria-label')).toBe('Gallery')
    const slides = slidesEls(container)
    expect(slides[0].getAttribute('aria-roledescription')).toBe('slide')
    expect(slides[0].getAttribute('aria-hidden')).toBeNull()
    expect(slides[1].getAttribute('aria-hidden')).toBe('true')
  })
})
