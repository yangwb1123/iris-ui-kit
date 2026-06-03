import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisRangeSlider } from './RangeSlider'

afterEach(() => cleanup())

function thumbs(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[role="slider"]')) as HTMLElement[]
}

describe('@iris-ui/react IrisRangeSlider', () => {
  it('renders track + range + two thumbs', () => {
    render(<IrisRangeSlider value={[20, 80]} />)
    expect(document.querySelector('[data-iris-range-slider-track]')).not.toBeNull()
    expect(document.querySelector('[data-iris-range-slider-range]')).not.toBeNull()
    expect(document.querySelectorAll('[data-iris-range-slider-thumb]').length).toBe(2)
  })

  it('thumbs expose role="slider" + bounded aria-value attrs', () => {
    render(<IrisRangeSlider value={[20, 80]} min={0} max={100} />)
    const [start, end] = thumbs()
    expect(start!.getAttribute('aria-valuenow')).toBe('20')
    expect(start!.getAttribute('aria-valuemin')).toBe('0')
    expect(start!.getAttribute('aria-valuemax')).toBe('80')
    expect(end!.getAttribute('aria-valuenow')).toBe('80')
    expect(end!.getAttribute('aria-valuemin')).toBe('20')
    expect(end!.getAttribute('aria-valuemax')).toBe('100')
  })

  it('range bar position derives from values', () => {
    render(<IrisRangeSlider value={[20, 80]} min={0} max={100} />)
    const range = document.querySelector('[data-iris-range-slider-range]') as HTMLElement
    // Logical inset (flips under RTL) rather than physical left.
    expect(range.style.insetInlineStart).toBe('20%')
    expect(range.style.width).toBe('60%')
  })

  it('ArrowRight on start thumb emits +step', () => {
    const onChange = vi.fn()
    render(<IrisRangeSlider value={[20, 80]} step={5} onChange={onChange} />)
    act(() => {
      fireEvent.keyDown(thumbs()[0]!, { key: 'ArrowRight' })
    })
    expect(onChange).toHaveBeenCalledWith([25, 80])
  })

  it('ArrowLeft on end thumb emits -step', () => {
    const onChange = vi.fn()
    render(<IrisRangeSlider value={[20, 80]} step={5} onChange={onChange} />)
    act(() => {
      fireEvent.keyDown(thumbs()[1]!, { key: 'ArrowLeft' })
    })
    expect(onChange).toHaveBeenCalledWith([20, 75])
  })

  it('start handle clamps against end (cannot cross it)', () => {
    const onChange = vi.fn()
    render(<IrisRangeSlider value={[75, 80]} step={5} onChange={onChange} />)
    act(() => {
      fireEvent.keyDown(thumbs()[0]!, { key: 'ArrowRight' })
    })
    expect(onChange).toHaveBeenLastCalledWith([80, 80])
  })

  it('end handle clamps against start (cannot cross it)', () => {
    const onChange = vi.fn()
    render(<IrisRangeSlider value={[20, 25]} step={5} onChange={onChange} />)
    act(() => {
      fireEvent.keyDown(thumbs()[1]!, { key: 'ArrowLeft' })
    })
    expect(onChange).toHaveBeenLastCalledWith([20, 20])
  })

  it('Home on start thumb jumps to min', () => {
    const onChange = vi.fn()
    render(<IrisRangeSlider value={[30, 80]} min={0} onChange={onChange} />)
    act(() => {
      fireEvent.keyDown(thumbs()[0]!, { key: 'Home' })
    })
    expect(onChange).toHaveBeenLastCalledWith([0, 80])
  })

  it('End on end thumb jumps to max', () => {
    const onChange = vi.fn()
    render(<IrisRangeSlider value={[20, 70]} max={100} onChange={onChange} />)
    act(() => {
      fireEvent.keyDown(thumbs()[1]!, { key: 'End' })
    })
    expect(onChange).toHaveBeenLastCalledWith([20, 100])
  })

  it('PageUp jumps by step×10', () => {
    const onChange = vi.fn()
    render(<IrisRangeSlider value={[20, 70]} step={2} onChange={onChange} />)
    act(() => {
      fireEvent.keyDown(thumbs()[0]!, { key: 'PageUp' })
    })
    expect(onChange).toHaveBeenLastCalledWith([40, 70])
  })

  it('disabled blocks key emit', () => {
    const onChange = vi.fn()
    render(<IrisRangeSlider value={[20, 80]} disabled onChange={onChange} />)
    act(() => {
      fireEvent.keyDown(thumbs()[0]!, { key: 'ArrowRight' })
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('respects decimal step (0.1)', () => {
    const onChange = vi.fn()
    render(<IrisRangeSlider value={[0.2, 0.8]} step={0.1} min={0} max={1} onChange={onChange} />)
    act(() => {
      fireEvent.keyDown(thumbs()[0]!, { key: 'ArrowRight' })
    })
    expect((onChange.mock.calls.at(-1)![0] as number[])[0]).toBeCloseTo(0.3, 5)
  })

  it('uncontrolled defaultValue sets initial thumbs', () => {
    render(<IrisRangeSlider defaultValue={[10, 90]} />)
    const [start, end] = thumbs()
    expect(start!.getAttribute('aria-valuenow')).toBe('10')
    expect(end!.getAttribute('aria-valuenow')).toBe('90')
  })
})
