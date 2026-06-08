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

  it('renders indicator dots', () => {
    const { container } = render(IrisCarousel, { props: { slideCount: 3, value: 0 } })
    const indicators = container.querySelector('[data-iris-carousel-indicators]')
    expect(indicators).toBeTruthy()
    expect(indicators!.querySelectorAll('button').length).toBe(3)
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
