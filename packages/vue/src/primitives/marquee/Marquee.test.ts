import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisMarquee } from './Marquee'

const copies = (w: ReturnType<typeof mount>) => w.findAll('[data-iris-marquee-content]')

describe('IrisMarquee', () => {
  it('renders the content', () => {
    const w = mount(IrisMarquee, { slots: { default: '<span>News flash</span>' } })
    expect(copies(w)[0].text()).toBe('News flash')
  })

  it('duplicates content for a seamless loop; the copy is aria-hidden', () => {
    const w = mount(IrisMarquee, { slots: { default: '<span>x</span>' } })
    expect(copies(w).length).toBe(2)
    expect(copies(w)[0].attributes('aria-hidden')).toBeUndefined()
    expect(copies(w)[1].attributes('aria-hidden')).toBe('true')
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
      const w = mount(IrisMarquee, { slots: { default: 'Scrolling text' } })
      expect(animate).toHaveBeenCalledTimes(1)

      matches = true
      listeners.forEach((listener) => listener({ matches }))
      expect(animations[0]?.cancel).toHaveBeenCalledTimes(1)

      matches = false
      listeners.forEach((listener) => listener({ matches }))
      expect(animate).toHaveBeenCalledTimes(2)

      w.unmount()
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
    const w = mount(IrisMarquee, { slots: { default: '<span>x</span>' } })
    expect((w.find('[data-iris-marquee]').element as HTMLElement).style.overflow).toBe('hidden')
  })
})
