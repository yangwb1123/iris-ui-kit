import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisMarquee } from './IrisMarquee'

afterEach(() => {
  cleanup()
})

describe('IrisMarquee', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisMarquee>Scrolling text</IrisMarquee>)
    expect(container.querySelector('[data-iris-marquee]')).not.toBeNull()
  })

  it('renders a track element', () => {
    const { container } = render(() => <IrisMarquee>Content</IrisMarquee>)
    expect(container.querySelector('[data-iris-marquee-track]')).not.toBeNull()
  })

  it('renders content twice (original + aria-hidden copy)', () => {
    const { container } = render(() => <IrisMarquee>Repeat me</IrisMarquee>)
    const content = container.querySelectorAll('[data-iris-marquee-content]')
    expect(content.length).toBe(2)
    expect(content[1]?.getAttribute('aria-hidden')).toBe('true')
  })

  it('stops and resumes when reduced-motion changes', () => {
    type Listener = (event: { matches: boolean }) => void
    const listeners = new Set<Listener>()
    let matches = false
    const mediaQuery = {
      get matches() {
        return matches
      },
      addEventListener: vi.fn((_type: string, listener: Listener) => listeners.add(listener)),
      removeEventListener: vi.fn((_type: string, listener: Listener) => listeners.delete(listener)),
    }
    const originalMatchMedia = window.matchMedia
    const originalAnimate = HTMLElement.prototype.animate
    const animations: Array<{ cancel: ReturnType<typeof vi.fn> }> = []
    const animate = vi.fn(() => {
      const animation = { cancel: vi.fn() }
      animations.push(animation)
      return animation as unknown as Animation
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => mediaQuery),
    })
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: animate,
    })

    try {
      render(() => <IrisMarquee>Scrolling text</IrisMarquee>)
      expect(animate).toHaveBeenCalledTimes(1)

      matches = true
      listeners.forEach((listener) => listener({ matches }))
      expect(animations[0]?.cancel).toHaveBeenCalledTimes(1)

      matches = false
      listeners.forEach((listener) => listener({ matches }))
      expect(animate).toHaveBeenCalledTimes(2)

      cleanup()
      expect(mediaQuery.removeEventListener).toHaveBeenCalledTimes(1)
    } finally {
      if (originalMatchMedia) {
        Object.defineProperty(window, 'matchMedia', {
          configurable: true,
          value: originalMatchMedia,
        })
      } else {
        Reflect.deleteProperty(window, 'matchMedia')
      }
      if (originalAnimate) {
        Object.defineProperty(HTMLElement.prototype, 'animate', {
          configurable: true,
          value: originalAnimate,
        })
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'animate')
      }
    }
  })

  it('shows the content', () => {
    const { getAllByText } = render(() => <IrisMarquee>Hello world</IrisMarquee>)
    // Two copies — one visible, one aria-hidden
    expect(getAllByText('Hello world').length).toBeGreaterThanOrEqual(1)
  })
})
