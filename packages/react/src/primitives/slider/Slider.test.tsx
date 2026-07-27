import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisSlider } from './Slider'

afterEach(() => cleanup())

function thumb(): HTMLElement {
  return document.querySelector('[data-iris-slider-thumb]') as HTMLElement
}

describe('@iris-ui-kit/react IrisSlider', () => {
  it('renders track + fill + thumb with role="slider"', () => {
    render(<IrisSlider value={40} />)
    expect(document.querySelector('[data-iris-slider]')).not.toBeNull()
    expect(document.querySelector('[data-iris-slider-track]')).not.toBeNull()
    expect(document.querySelector('[data-iris-slider-fill]')).not.toBeNull()
    expect(thumb()).not.toBeNull()
    expect(thumb().getAttribute('role')).toBe('slider')
  })

  it('aria-valuenow / valuemin / valuemax reflect props', () => {
    render(<IrisSlider value={30} min={10} max={80} />)
    expect(thumb().getAttribute('aria-valuenow')).toBe('30')
    expect(thumb().getAttribute('aria-valuemin')).toBe('10')
    expect(thumb().getAttribute('aria-valuemax')).toBe('80')
  })

  it('fill bar width derives from value', () => {
    render(<IrisSlider value={25} min={0} max={100} />)
    const fill = document.querySelector('[data-iris-slider-fill]') as HTMLElement
    expect(fill.style.width).toBe('25%')
  })

  it('ArrowRight increments by step', () => {
    const onChange = vi.fn()
    render(<IrisSlider value={20} step={5} onChange={onChange} />)
    act(() => {
      fireEvent.keyDown(thumb(), { key: 'ArrowRight' })
    })
    expect(onChange).toHaveBeenCalledWith(25)
  })

  it('ArrowLeft decrements by step', () => {
    const onChange = vi.fn()
    render(<IrisSlider value={20} step={5} onChange={onChange} />)
    act(() => {
      fireEvent.keyDown(thumb(), { key: 'ArrowLeft' })
    })
    expect(onChange).toHaveBeenCalledWith(15)
  })

  it('Home jumps to min, End jumps to max', () => {
    const onChange = vi.fn()
    render(<IrisSlider value={50} min={10} max={90} onChange={onChange} />)
    act(() => {
      fireEvent.keyDown(thumb(), { key: 'Home' })
    })
    expect(onChange).toHaveBeenLastCalledWith(10)
    act(() => {
      fireEvent.keyDown(thumb(), { key: 'End' })
    })
    expect(onChange).toHaveBeenLastCalledWith(90)
  })

  it('PageUp jumps by step×10', () => {
    const onChange = vi.fn()
    render(<IrisSlider value={20} step={2} onChange={onChange} />)
    act(() => {
      fireEvent.keyDown(thumb(), { key: 'PageUp' })
    })
    expect(onChange).toHaveBeenLastCalledWith(40)
  })

  it('clamps over max', () => {
    const onChange = vi.fn()
    // 90 is on-grid; PageUp (+step×10 = +50) overshoots to 140 and must clamp to max.
    render(<IrisSlider value={90} step={5} max={100} onChange={onChange} />)
    act(() => {
      fireEvent.keyDown(thumb(), { key: 'PageUp' })
    })
    expect(onChange).toHaveBeenLastCalledWith(100)
  })

  it('disabled blocks key emit', () => {
    const onChange = vi.fn()
    render(<IrisSlider value={20} disabled onChange={onChange} />)
    act(() => {
      fireEvent.keyDown(thumb(), { key: 'ArrowRight' })
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('respects decimal step (0.1)', () => {
    const onChange = vi.fn()
    render(<IrisSlider value={0.2} step={0.1} min={0} max={1} onChange={onChange} />)
    act(() => {
      fireEvent.keyDown(thumb(), { key: 'ArrowRight' })
    })
    expect(onChange.mock.calls.at(-1)![0]).toBeCloseTo(0.3, 5)
  })

  it('vertical orientation reflects on data attr + aria', () => {
    render(<IrisSlider value={40} orientation="vertical" />)
    expect(
      document.querySelector('[data-iris-slider]')?.getAttribute('data-iris-slider-orientation'),
    ).toBe('vertical')
    expect(thumb().getAttribute('aria-orientation')).toBe('vertical')
  })

  it('uncontrolled defaultValue sets initial', () => {
    render(<IrisSlider defaultValue={40} />)
    expect(thumb().getAttribute('aria-valuenow')).toBe('40')
  })

  // jsdom returns a zero rect from getBoundingClientRect, so mock it to verify
  // the pointer→value mapping (and its RTL flip).
  function mockTrackRect(): HTMLElement {
    const track = document.querySelector('[data-iris-slider-track]') as HTMLElement
    track.getBoundingClientRect = () =>
      ({ left: 0, right: 200, top: 0, bottom: 10, width: 200, height: 10, x: 0, y: 0 }) as DOMRect
    return track
  }
  // jsdom may lack a PointerEvent constructor that carries clientX — build it
  // explicitly and dispatch natively (React picks it up via root delegation).
  function pointerDownAt(el: HTMLElement, clientX: number): void {
    const ev = new Event('pointerdown', { bubbles: true })
    Object.assign(ev, { clientX, clientY: 0, button: 0, pointerId: 1 })
    el.dispatchEvent(ev)
  }

  it('LTR track pointerdown maps left→value', () => {
    const onChange = vi.fn()
    render(<IrisSlider value={0} min={0} max={100} onChange={onChange} />)
    act(() => {
      pointerDownAt(mockTrackRect(), 50)
    })
    expect(onChange).toHaveBeenLastCalledWith(25)
  })

  it('RTL track pointerdown maps from the right edge', () => {
    const onChange = vi.fn()
    render(
      <div dir="rtl">
        <IrisSlider value={0} min={0} max={100} onChange={onChange} />
      </div>,
    )
    act(() => {
      pointerDownAt(mockTrackRect(), 50)
    })
    // (right - clientX) / width = (200 - 50) / 200 = 0.75
    expect(onChange).toHaveBeenLastCalledWith(75)
  })
})
