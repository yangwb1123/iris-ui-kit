import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisMarquee from './IrisMarquee.svelte'

afterEach(() => {
  cleanup()
})

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
      render(IrisMarquee)
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

  it('second copy is aria-hidden', () => {
    const { container } = render(IrisMarquee)
    const copies = container.querySelectorAll('[data-iris-marquee-content]')
    expect(copies[1].getAttribute('aria-hidden')).toBe('true')
  })
})
