import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisRangeSlider } from './IrisRangeSlider'

afterEach(cleanup)

describe('IrisRangeSlider', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisRangeSlider />)
    expect(container.querySelector('[data-iris-range-slider]')).not.toBeNull()
  })

  it('renders two thumbs', () => {
    const { container } = render(() => <IrisRangeSlider />)
    const thumbs = container.querySelectorAll('[data-iris-range-slider-thumb]')
    expect(thumbs.length).toBe(2)
  })

  it('thumbs have correct aria attributes', () => {
    const { container } = render(() => <IrisRangeSlider value={[20, 80]} min={0} max={100} />)
    const thumbs = container.querySelectorAll('[role="slider"]')
    expect(thumbs[0].getAttribute('aria-valuenow')).toBe('20')
    expect(thumbs[1].getAttribute('aria-valuenow')).toBe('80')
  })

  it('responds to ArrowRight on start thumb', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisRangeSlider defaultValue={[20, 80]} onChange={onChange} />
    ))
    const startThumb = container.querySelector(
      '[data-iris-range-slider-thumb="start"]',
    ) as HTMLElement
    fireEvent.keyDown(startThumb, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith([21, 80])
  })

  function mockTrackRect(): HTMLElement {
    const track = document.querySelector('[data-iris-range-slider-track]') as HTMLElement
    track.getBoundingClientRect = () =>
      ({ left: 0, right: 200, top: 0, bottom: 4, width: 200, height: 4 }) as DOMRect
    return track
  }

  function pointerEvent(type: string, clientX: number): Event {
    const event = new Event(type, { bubbles: true })
    Object.assign(event, { button: 0, clientX, clientY: 0, pointerId: 1 })
    return event
  }

  function dragTo(thumb: HTMLElement, clientX: number): void {
    thumb.setPointerCapture = vi.fn()
    thumb.dispatchEvent(pointerEvent('pointerdown', clientX))
    thumb.dispatchEvent(pointerEvent('pointermove', clientX))
  }

  it('maps RTL pointer endpoints from the right edge', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <div dir="rtl">
        <IrisRangeSlider defaultValue={[50, 100]} onChange={onChange} />
      </div>
    ))
    mockTrackRect()
    const startThumb = container.querySelector(
      '[data-iris-range-slider-thumb="start"]',
    ) as HTMLElement
    dragTo(startThumb, 0)
    expect(onChange).toHaveBeenLastCalledWith([100, 100])

    cleanup()
    const second = render(() => (
      <div dir="rtl">
        <IrisRangeSlider defaultValue={[0, 50]} onChange={onChange} />
      </div>
    ))
    mockTrackRect()
    const endThumb = second.container.querySelector(
      '[data-iris-range-slider-thumb="end"]',
    ) as HTMLElement
    dragTo(endThumb, 200)
    expect(onChange).toHaveBeenLastCalledWith([0, 0])
  })

  it('keeps LTR pointer endpoints mapped from the left edge', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <div dir="ltr">
        <IrisRangeSlider defaultValue={[50, 100]} onChange={onChange} />
      </div>
    ))
    mockTrackRect()
    const startThumb = container.querySelector(
      '[data-iris-range-slider-thumb="start"]',
    ) as HTMLElement
    dragTo(startThumb, 0)
    expect(onChange).toHaveBeenLastCalledWith([0, 100])

    cleanup()
    const second = render(() => (
      <div dir="ltr">
        <IrisRangeSlider defaultValue={[0, 50]} onChange={onChange} />
      </div>
    ))
    mockTrackRect()
    const endThumb = second.container.querySelector(
      '[data-iris-range-slider-thumb="end"]',
    ) as HTMLElement
    dragTo(endThumb, 200)
    expect(onChange).toHaveBeenLastCalledWith([0, 100])
  })
})
