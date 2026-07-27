import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisColorPicker } from './IrisColorPicker'
import { clamp01, hexToRgba, hsvaToRgba, rgbaToHsva, rgbToHex } from './colorUtils'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function query<T extends HTMLElement>(container: HTMLElement, selector: string): T {
  return container.querySelector(selector) as T
}

function mockRect(element: HTMLElement, width = 100, height = 100): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  })
}

describe('Solid color picker color utilities', () => {
  it('parses short, long, and alpha hex values', () => {
    expect(hexToRgba('#0f0')).toEqual({ r: 0, g: 255, b: 0, a: 1 })
    expect(hexToRgba('#3366cc')).toEqual({ r: 51, g: 102, b: 204, a: 1 })
    expect(hexToRgba('#0000ff80')).toEqual({ r: 0, g: 0, b: 255, a: 128 / 255 })
  })

  it('rejects malformed colors and clamps unit intervals', () => {
    expect(hexToRgba('#12')).toBeNull()
    expect(hexToRgba('#xyz')).toBeNull()
    expect(clamp01(-0.5)).toBe(0)
    expect(clamp01(1.5)).toBe(1)
  })

  it('round-trips an opaque saturated color through HSVA', () => {
    const rgba = hexToRgba('#22c55e')!
    expect(rgbToHex(hsvaToRgba(rgbaToHsva(rgba)))).toBe('#22c55e')
  })
})

describe('IrisColorPicker', () => {
  it('renders the saturation/value surface, hue slider, and labelled hex input', () => {
    const { container } = render(() => <IrisColorPicker />)
    expect(container.querySelector('[data-iris-color-picker]')).not.toBeNull()
    expect(container.querySelector('[data-iris-color-picker-sv]')).not.toBeNull()
    expect(container.querySelector('[data-iris-color-picker-hue]')).not.toBeNull()
    expect(query<HTMLInputElement>(container, '[data-iris-color-picker-hex]').ariaLabel).toBe('Hex')
  })

  it('uses defaultValue for the initial uncontrolled value', () => {
    const { container } = render(() => <IrisColorPicker defaultValue="#ff0000" />)
    expect(query<HTMLInputElement>(container, '[data-iris-color-picker-hex]').value).toBe('#ff0000')
  })

  it('renders only the supplied preset swatches', () => {
    const { container } = render(() => (
      <IrisColorPicker presets={['#ff0000', '#00ff00', '#0000ff']} />
    ))
    const presets = container.querySelectorAll('[data-iris-color-picker-preset]')
    expect(presets.length).toBe(3)
    expect(Array.from(presets, (preset) => preset.getAttribute('title'))).toEqual([
      '#ff0000',
      '#00ff00',
      '#0000ff',
    ])
  })

  it('hides the presets region when the list is empty', () => {
    const { container } = render(() => <IrisColorPicker presets={[]} />)
    expect(container.querySelector('[data-iris-color-picker-presets]')).toBeNull()
  })

  it('normalizes a valid hex input and reports it', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisColorPicker onChange={onChange} />)
    const input = query<HTMLInputElement>(container, '[data-iris-color-picker-hex]')

    fireEvent.input(input, { target: { value: '#0f0' } })

    expect(onChange).toHaveBeenLastCalledWith('#00ff00')
    expect(input.value).toBe('#0f0')
  })

  it('keeps malformed input editable without emitting a color', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisColorPicker onChange={onChange} />)
    const input = query<HTMLInputElement>(container, '[data-iris-color-picker-hex]')

    fireEvent.input(input, { target: { value: '#nothex' } })

    expect(input.value).toBe('#nothex')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('selecting a preset updates uncontrolled state and active styling', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisColorPicker
        defaultValue="#ff0000"
        presets={['#ff0000', '#00ff00']}
        onChange={onChange}
      />
    ))
    const green = query<HTMLButtonElement>(container, '[data-iris-color-picker-preset="#00ff00"]')

    fireEvent.click(green)

    expect(onChange).toHaveBeenLastCalledWith('#00ff00')
    expect(query<HTMLInputElement>(container, '[data-iris-color-picker-hex]').value).toBe('#00ff00')
    expect(green.getAttribute('data-active')).toBe('true')
  })

  it('maps hue pointer position to a normalized color', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisColorPicker defaultValue="#ff0000" onChange={onChange} />
    ))
    const hue = query<HTMLDivElement>(container, '[data-iris-color-picker-hue]')
    mockRect(hue, 120, 14)

    fireEvent.mouseDown(hue, { clientX: 60, clientY: 7 })

    expect(onChange).toHaveBeenLastCalledWith('#00ffff')
  })

  it('clamps saturation/value pointer coordinates to the surface', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisColorPicker defaultValue="#ff0000" onChange={onChange} />
    ))
    const surface = query<HTMLDivElement>(container, '[data-iris-color-picker-sv]')
    mockRect(surface, 100, 100)

    fireEvent.mouseDown(surface, { clientX: 200, clientY: -20 })

    expect(onChange).toHaveBeenLastCalledWith('#ff0000')
    const cursor = surface.lastElementChild as HTMLDivElement
    expect(cursor.style.left).toBe('100%')
    expect(cursor.style.top).toBe('0%')
  })

  it('continues a hue drag on document and stops after mouseup', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisColorPicker defaultValue="#ff0000" onChange={onChange} />
    ))
    const hue = query<HTMLDivElement>(container, '[data-iris-color-picker-hue]')
    mockRect(hue)
    fireEvent.mouseDown(hue, { clientX: 0 })
    fireEvent.mouseMove(document, { clientX: 100 / 3 })
    expect(onChange).toHaveBeenLastCalledWith('#00ff00')

    fireEvent.mouseUp(document)
    const callsAfterRelease = onChange.mock.calls.length
    fireEvent.mouseMove(document, { clientX: 66 })
    expect(onChange).toHaveBeenCalledTimes(callsAfterRelease)
  })

  it('disables every interactive color control', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisColorPicker disabled presets={['#ff0000']} onChange={onChange} />
    ))
    const root = query<HTMLDivElement>(container, '[data-iris-color-picker]')
    const input = query<HTMLInputElement>(container, '[data-iris-color-picker-hex]')
    const preset = query<HTMLButtonElement>(container, '[data-iris-color-picker-preset]')
    const hue = query<HTMLDivElement>(container, '[data-iris-color-picker-hue]')
    mockRect(hue)

    expect(root.hasAttribute('data-disabled')).toBe(true)
    expect(input.disabled).toBe(true)
    expect(preset.disabled).toBe(true)
    fireEvent.mouseDown(hue, { clientX: 50 })
    expect(onChange).not.toHaveBeenCalled()
  })
})
