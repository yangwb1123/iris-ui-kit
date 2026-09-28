import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisMarquee } from './Marquee'

afterEach(() => cleanup())

const copies = (c: HTMLElement) => c.querySelectorAll('[data-iris-marquee-content]')

describe('@iris-ui-kit/react IrisMarquee', () => {
  it('renders the content', () => {
    const { container } = render(
      <IrisMarquee>
        <span>News flash</span>
      </IrisMarquee>,
    )
    expect(copies(container)[0].textContent).toBe('News flash')
  })

  it('duplicates content for a seamless loop; the copy is aria-hidden', () => {
    const { container } = render(
      <IrisMarquee>
        <span>x</span>
      </IrisMarquee>,
    )
    expect(copies(container).length).toBe(2)
    expect(copies(container)[0].getAttribute('aria-hidden')).toBeNull()
    expect(copies(container)[1].getAttribute('aria-hidden')).toBe('true')
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
      const { unmount } = render(<IrisMarquee>Scrolling text</IrisMarquee>)
      expect(animate).toHaveBeenCalledTimes(1)

      matches = true
      listeners.forEach((listener) => listener({ matches }))
      expect(animations[0]?.cancel).toHaveBeenCalledTimes(1)

      matches = false
      listeners.forEach((listener) => listener({ matches }))
      expect(animate).toHaveBeenCalledTimes(2)

      unmount()
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

  it('clips overflow', () => {
    const { container } = render(
      <IrisMarquee>
        <span>x</span>
      </IrisMarquee>,
    )
    expect((container.querySelector('[data-iris-marquee]') as HTMLElement).style.overflow).toBe(
      'hidden',
    )
  })
})
