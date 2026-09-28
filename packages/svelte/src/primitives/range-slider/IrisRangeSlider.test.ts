import { cleanup, render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisRangeSlider from './IrisRangeSlider.svelte'

describe('IrisRangeSlider', () => {
  it('renders two thumb sliders', () => {
    const { container } = render(IrisRangeSlider, { props: { value: [20, 80] } })
    const thumbs = container.querySelectorAll('[role="slider"]')
    expect(thumbs.length).toBe(2)
  })

  it('shows start and end values in aria', () => {
    const { container } = render(IrisRangeSlider, { props: { value: [25, 75] } })
    const thumbs = container.querySelectorAll('[role="slider"]')
    expect(thumbs[0].getAttribute('aria-valuenow')).toBe('25')
    expect(thumbs[1].getAttribute('aria-valuenow')).toBe('75')
  })

  it('moves start value with arrow key', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisRangeSlider, {
      props: { value: [20, 80], step: 1, onchange },
    })
    const startThumb = container.querySelector(
      '[data-iris-range-slider-thumb="start"]',
    ) as HTMLElement
    await fireEvent.keyDown(startThumb, { key: 'ArrowRight' })
    flushSync()
    expect(onchange).toHaveBeenCalledWith([21, 80])
  })

  function mockTrackRect(container: HTMLElement): HTMLElement {
    const track = container.querySelector('[data-iris-range-slider-track]') as HTMLElement
    track.getBoundingClientRect = () =>
      ({ left: 0, right: 200, top: 0, bottom: 4, width: 200, height: 4 }) as DOMRect
    return track
  }

  function pointerEvent(type: string, clientX: number): Event {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(event, { button: 0, clientX, clientY: 0, pointerId: 1 })
    return event
  }

  function dragTo(thumb: HTMLElement, clientX: number): void {
    thumb.setPointerCapture = vi.fn()
    thumb.dispatchEvent(pointerEvent('pointerdown', clientX))
    thumb.dispatchEvent(pointerEvent('pointermove', clientX))
  }

  it('maps RTL pointer endpoints from the right edge', () => {
    const onchange = vi.fn()
    const { container } = render(IrisRangeSlider, {
      props: { value: [50, 100], dir: 'rtl', onchange },
    })
    mockTrackRect(container)
    const startThumb = container.querySelector(
      '[data-iris-range-slider-thumb="start"]',
    ) as HTMLElement
    dragTo(startThumb, 0)
    flushSync()
    expect(onchange).toHaveBeenLastCalledWith([100, 100])

    cleanup()
    const second = render(IrisRangeSlider, {
      props: { value: [0, 50], dir: 'rtl', onchange },
    })
    mockTrackRect(second.container)
    const endThumb = second.container.querySelector(
      '[data-iris-range-slider-thumb="end"]',
    ) as HTMLElement
    dragTo(endThumb, 200)
    flushSync()
    expect(onchange).toHaveBeenLastCalledWith([0, 0])
  })

  it('keeps LTR pointer endpoints mapped from the left edge', () => {
    const onchange = vi.fn()
    const { container } = render(IrisRangeSlider, {
      props: { value: [50, 100], dir: 'ltr', onchange },
    })
    mockTrackRect(container)
    const startThumb = container.querySelector(
      '[data-iris-range-slider-thumb="start"]',
    ) as HTMLElement
    dragTo(startThumb, 0)
    flushSync()
    expect(onchange).toHaveBeenLastCalledWith([0, 100])

    cleanup()
    const second = render(IrisRangeSlider, {
      props: { value: [0, 50], dir: 'ltr', onchange },
    })
    mockTrackRect(second.container)
    const endThumb = second.container.querySelector(
      '[data-iris-range-slider-thumb="end"]',
    ) as HTMLElement
    dragTo(endThumb, 200)
    flushSync()
    expect(onchange).toHaveBeenLastCalledWith([0, 100])
  })
})
