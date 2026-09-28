import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect } from 'vitest'
import IrisCarousel from './IrisCarousel.svelte'

describe('IrisCarousel', () => {
  it('renders without crashing', () => {
    const { container } = render(IrisCarousel, { props: { slideCount: 3 } })
    expect(container.querySelector('[data-iris-carousel]')).toBeTruthy()
  })

  it('renders arrow buttons', () => {
    const { container } = render(IrisCarousel, { props: { slideCount: 3 } })
    expect(container.querySelector('[data-iris-carousel-prev]')).toBeTruthy()
    expect(container.querySelector('[data-iris-carousel-next]')).toBeTruthy()
  })

  it('uses logical inline insets for arrows in LTR and RTL', () => {
    const { container } = render(IrisCarousel, { props: { slideCount: 3 } })
    const root = container.querySelector('[data-iris-carousel]') as HTMLElement
    const prev = container.querySelector('[data-iris-carousel-prev]') as HTMLElement
    const next = container.querySelector('[data-iris-carousel-next]') as HTMLElement

    const assertLogicalInsets = () => {
      expect(prev.style.getPropertyValue('inset-inline-start')).toBe('8px')
      expect(prev.style.left).toBe('')
      expect(prev.style.right).toBe('')
      expect(prev.getAttribute('style')).not.toMatch(/(?:^|;)\s*(?:left|right)\s*:/)
      expect(next.style.getPropertyValue('inset-inline-end')).toBe('8px')
      expect(next.style.left).toBe('')
      expect(next.style.right).toBe('')
      expect(next.getAttribute('style')).not.toMatch(/(?:^|;)\s*(?:left|right)\s*:/)
    }

    root.setAttribute('dir', 'ltr')
    assertLogicalInsets()
    root.setAttribute('dir', 'rtl')
    assertLogicalInsets()
  })

  it('renders indicator dots', () => {
    const { container } = render(IrisCarousel, { props: { slideCount: 3, value: 0 } })
    const indicators = container.querySelector('[data-iris-carousel-indicators]')
    expect(indicators).toBeTruthy()
    expect(indicators!.querySelectorAll('button').length).toBe(3)
    // The dots are real activatable controls — the container must NOT be
    // aria-hidden (which would hide them from assistive tech).
    expect(indicators!.getAttribute('aria-hidden')).toBeNull()
  })

  it('marks the active indicator with aria-current for assistive tech', () => {
    // Regression: indicators previously exposed only a `data-state` styling hook,
    // so screen-reader users couldn't tell which slide was active (react/vue
    // already used aria-current).
    const { container } = render(IrisCarousel, { props: { slideCount: 3, value: 1 } })
    const dots = container.querySelectorAll('[data-iris-carousel-indicators] button')
    expect(dots[0]!.getAttribute('aria-current')).toBeNull()
    expect(dots[1]!.getAttribute('aria-current')).toBe('true')
    expect(dots[2]!.getAttribute('aria-current')).toBeNull()
  })

  it('calls onValueChange on next click', async () => {
    let changed: number | null = null
    const { container } = render(IrisCarousel, {
      props: {
        slideCount: 3,
        value: 0,
        onValueChange: (i: number) => {
          changed = i
        },
      },
    })
    const next = container.querySelector('[data-iris-carousel-next]')!
    await fireEvent.click(next)
    flushSync()
    expect(changed).toBe(1)
  })
})
