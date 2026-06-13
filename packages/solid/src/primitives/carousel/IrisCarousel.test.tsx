import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisCarousel } from './IrisCarousel'

afterEach(cleanup)

describe('IrisCarousel', () => {
  it('renders without crashing', () => {
    const { container } = render(() => (
      <IrisCarousel>
        <div>Slide 1</div>
        <div>Slide 2</div>
      </IrisCarousel>
    ))
    expect(container.querySelector('[data-iris-carousel]')).not.toBeNull()
  })

  it('renders prev/next buttons when multiple slides', () => {
    const { container } = render(() => (
      <IrisCarousel>
        <div>Slide 1</div>
        <div>Slide 2</div>
      </IrisCarousel>
    ))
    expect(container.querySelector('[data-iris-carousel-prev]')).not.toBeNull()
    expect(container.querySelector('[data-iris-carousel-next]')).not.toBeNull()
  })

  it('renders indicator dots', () => {
    const { container } = render(() => (
      <IrisCarousel>
        <div>Slide 1</div>
        <div>Slide 2</div>
        <div>Slide 3</div>
      </IrisCarousel>
    ))
    const dots = container.querySelectorAll('[data-iris-carousel-indicator]')
    expect(dots.length).toBe(3)
  })

  it('advances to next slide on next button click', () => {
    const { container } = render(() => (
      <IrisCarousel defaultIndex={0}>
        <div>Slide 1</div>
        <div>Slide 2</div>
      </IrisCarousel>
    ))
    const nextBtn = container.querySelector('[data-iris-carousel-next]') as HTMLButtonElement
    fireEvent.click(nextBtn)
    const dot1 = container.querySelector('[data-iris-carousel-indicator="1"]') as HTMLButtonElement
    expect(dot1.getAttribute('aria-selected')).toBe('true')
  })
})
