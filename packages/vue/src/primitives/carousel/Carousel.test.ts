import { describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisCarousel } from './Carousel'

const threeSlides = () => [h('div', 'One'), h('div', 'Two'), h('div', 'Three')]

const slidesEls = (w: ReturnType<typeof mount>) => w.findAll('[data-iris-carousel-slide]')
const root = (w: ReturnType<typeof mount>) => w.find('[data-iris-carousel]')

describe('IrisCarousel', () => {
  it('renders one slide element per child', () => {
    const w = mount(IrisCarousel, { slots: { default: threeSlides } })
    expect(slidesEls(w).length).toBe(3)
  })

  it('next / prev arrows emit the index', async () => {
    const w = mount(IrisCarousel, { slots: { default: threeSlides } })
    await w.find('[data-iris-carousel-next]').trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([1])
  })

  it('renders an indicator per slide and jumps on click', async () => {
    const w = mount(IrisCarousel, { slots: { default: threeSlides } })
    const dots = w.findAll('[data-iris-carousel-indicator]')
    expect(dots.length).toBe(3)
    await dots[2].trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([2])
  })

  it('loops: prev from the first slide wraps to the last', async () => {
    const w = mount(IrisCarousel, { slots: { default: threeSlides } })
    await w.find('[data-iris-carousel-prev]').trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([2])
  })

  it('loop=false clamps and disables arrows at the ends', async () => {
    const w = mount(IrisCarousel, { props: { loop: false }, slots: { default: threeSlides } })
    const prev = w.find('[data-iris-carousel-prev]')
    expect(prev.attributes('disabled')).toBeDefined()
    await prev.trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('keyboard ArrowRight / ArrowLeft navigate', async () => {
    const w = mount(IrisCarousel, { slots: { default: threeSlides } })
    await root(w).trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([1])
  })

  it('controlled modelValue drives the track transform', () => {
    const w = mount(IrisCarousel, { props: { modelValue: 1 }, slots: { default: threeSlides } })
    const track = w.find('[data-iris-carousel-track]').element as HTMLElement
    expect(track.style.transform).toBe('translateX(-100%)')
  })

  it('a11y: carousel + slide roledescriptions; inactive slides are aria-hidden', () => {
    const w = mount(IrisCarousel, {
      props: { ariaLabel: 'Gallery' },
      slots: { default: threeSlides },
    })
    expect(root(w).attributes('aria-roledescription')).toBe('carousel')
    expect(root(w).attributes('aria-label')).toBe('Gallery')
    const slides = slidesEls(w)
    expect(slides[0].attributes('aria-roledescription')).toBe('slide')
    expect(slides[0].attributes('aria-hidden')).toBeUndefined()
    expect(slides[1].attributes('aria-hidden')).toBe('true')
  })

  it('autoplay advances after the interval', async () => {
    vi.useFakeTimers()
    try {
      const w = mount(IrisCarousel, {
        props: { autoplay: true, interval: 1000 },
        slots: { default: threeSlides },
      })
      vi.advanceTimersByTime(1000)
      await nextTick()
      expect(w.emitted('update:modelValue')?.[0]).toEqual([1])
    } finally {
      vi.useRealTimers()
    }
  })

  it('autoplay pauses on hover', async () => {
    vi.useFakeTimers()
    try {
      const w = mount(IrisCarousel, {
        props: { autoplay: true, interval: 1000 },
        slots: { default: threeSlides },
      })
      await root(w).trigger('mouseenter')
      vi.advanceTimersByTime(2000)
      await nextTick()
      expect(w.emitted('update:modelValue')).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('autoplay is disabled under prefers-reduced-motion', async () => {
    const original = window.matchMedia
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
    vi.useFakeTimers()
    try {
      const w = mount(IrisCarousel, {
        props: { autoplay: true, interval: 1000 },
        slots: { default: threeSlides },
      })
      vi.advanceTimersByTime(2000)
      await nextTick()
      expect(w.emitted('update:modelValue')).toBeUndefined()
    } finally {
      vi.useRealTimers()
      window.matchMedia = original
    }
  })
})
