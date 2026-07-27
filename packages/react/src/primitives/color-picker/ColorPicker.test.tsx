import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisColorPicker } from './ColorPicker'
import { hexToRgba, hsvToRgb, rgbToHex, rgbToHsv } from './colorUtils'

afterEach(() => cleanup())

function q<T extends HTMLElement = HTMLElement>(sel: string): T {
  return document.querySelector(sel) as T
}

describe('@iris-ui-kit/react colorUtils', () => {
  it('hexToRgba parses #rgb / #rrggbb / #rrggbbaa', () => {
    expect(hexToRgba('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    expect(hexToRgba('#00ff00')).toEqual({ r: 0, g: 255, b: 0, a: 1 })
    expect(hexToRgba('#0000ff80')).toEqual({ r: 0, g: 0, b: 255, a: 128 / 255 })
  })

  it('hexToRgba returns null on invalid input', () => {
    expect(hexToRgba('not-a-color')).toBeNull()
    expect(hexToRgba('#xyz')).toBeNull()
  })

  it('rgbToHex round trip via hexToRgba', () => {
    const rgba = hexToRgba('#3366cc')!
    expect(rgbToHex(rgba)).toBe('#3366cc')
  })

  it('rgbToHex appends alpha channel when < 1', () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('#00000080')
  })

  it('hsvToRgb red corner is pure red', () => {
    expect(hsvToRgb(0, 1, 1)).toEqual({ r: 255, g: 0, b: 0 })
  })

  it('rgbToHsv white is (h=0, s=0, v=1)', () => {
    expect(rgbToHsv(255, 255, 255)).toEqual({ h: 0, s: 0, v: 1 })
  })

  it('hsv → rgb → hsv preserves hue for saturated colors', () => {
    const { r, g, b } = hsvToRgb(180, 0.8, 0.9)
    const { h } = rgbToHsv(r, g, b)
    expect(Math.abs(h - 180)).toBeLessThan(1)
  })
})

describe('@iris-ui-kit/react IrisColorPicker', () => {
  it('renders pad + hue strip + hex/RGB inputs', () => {
    render(<IrisColorPicker value="#ff0000" />)
    expect(q('[data-iris-color-picker-pad]')).not.toBeNull()
    expect(q('[data-iris-color-picker-hue]')).not.toBeNull()
    expect(q('[data-iris-color-picker-hex]')).not.toBeNull()
    expect(q('[data-iris-color-picker-r]')).not.toBeNull()
    expect(q('[data-iris-color-picker-g]')).not.toBeNull()
    expect(q('[data-iris-color-picker-b]')).not.toBeNull()
  })

  it('hex input reflects value', () => {
    render(<IrisColorPicker value="#3366cc" />)
    expect(q<HTMLInputElement>('[data-iris-color-picker-hex]').value).toBe('#3366cc')
  })

  it('RGB inputs reflect value channels', () => {
    render(<IrisColorPicker value="#3366cc" />)
    expect(q<HTMLInputElement>('[data-iris-color-picker-r]').value).toBe('51')
    expect(q<HTMLInputElement>('[data-iris-color-picker-g]').value).toBe('102')
    expect(q<HTMLInputElement>('[data-iris-color-picker-b]').value).toBe('204')
  })

  it('committing the hex input (blur) emits a normalized hex', () => {
    const onChange = vi.fn()
    render(<IrisColorPicker value="#000000" onChange={onChange} />)
    const hex = q<HTMLInputElement>('[data-iris-color-picker-hex]')
    act(() => {
      fireEvent.change(hex, { target: { value: '#ff8000' } })
      fireEvent.blur(hex)
    })
    expect(onChange).toHaveBeenLastCalledWith('#ff8000')
  })

  it('Enter commits the hex input', () => {
    const onChange = vi.fn()
    render(<IrisColorPicker value="#000000" onChange={onChange} />)
    const hex = q<HTMLInputElement>('[data-iris-color-picker-hex]')
    act(() => {
      fireEvent.change(hex, { target: { value: '#00ff00' } })
      fireEvent.keyDown(hex, { key: 'Enter' })
    })
    expect(onChange).toHaveBeenLastCalledWith('#00ff00')
  })

  it('changing the R input emits a new hex', () => {
    const onChange = vi.fn()
    render(<IrisColorPicker value="#000000" onChange={onChange} />)
    act(() => {
      fireEvent.change(q('[data-iris-color-picker-r]'), { target: { value: '255' } })
    })
    expect(onChange).toHaveBeenLastCalledWith('#ff0000')
  })

  it('showAlpha=true renders alpha strip + alpha input', () => {
    render(<IrisColorPicker showAlpha value="#00000080" />)
    expect(q('[data-iris-color-picker-alpha]')).not.toBeNull()
    expect(q('[data-iris-color-picker-a]')).not.toBeNull()
  })

  it('showAlpha=false hides alpha strip + input', () => {
    render(<IrisColorPicker value="#000000" />)
    expect(q('[data-iris-color-picker-alpha]')).toBeNull()
    expect(q('[data-iris-color-picker-a]')).toBeNull()
  })

  it('disabled sets data-disabled on root', () => {
    render(<IrisColorPicker value="#000000" disabled />)
    expect(q('[data-iris-color-picker]').getAttribute('data-disabled')).toBe('true')
  })

  it('disabled disables the RGB inputs', () => {
    render(<IrisColorPicker value="#000000" disabled />)
    expect(q<HTMLInputElement>('[data-iris-color-picker-r]').disabled).toBe(true)
  })

  it('pad cursor position reflects s and v', () => {
    render(<IrisColorPicker value="#3366cc" />)
    const cursor = q('[data-iris-color-picker-pad-cursor]')
    expect(cursor.style.left).toMatch(/\d/)
    expect(cursor.style.top).toMatch(/\d/)
  })

  it('uncontrolled defaultValue sets initial color', () => {
    render(<IrisColorPicker defaultValue="#3366cc" />)
    expect(q<HTMLInputElement>('[data-iris-color-picker-hex]').value).toBe('#3366cc')
  })
})
