import { fireEvent, render } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import IrisColorPicker from './IrisColorPicker.svelte'

function saturation(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-color-picker-satval]') as HTMLElement
}

function hue(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-color-picker-hue]') as HTMLElement
}

function hexInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('[data-iris-color-picker-hex]') as HTMLInputElement
}

function setRect(element: HTMLElement, width: number, height: number): void {
  element.getBoundingClientRect = () =>
    ({
      bottom: height,
      height,
      left: 0,
      right: width,
      top: 0,
      width,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect
}

describe('IrisColorPicker', () => {
  it('renders two labelled sliders, a swatch, and a hex field', () => {
    const { container } = render(IrisColorPicker, { props: { value: '#ff0000' } })
    const root = container.querySelector('[data-iris-color-picker]')!

    expect(root).not.toBeNull()
    expect(saturation(container).getAttribute('role')).toBe('slider')
    expect(saturation(container).getAttribute('aria-label')).toBe('Saturation and brightness')
    expect(hue(container).getAttribute('role')).toBe('slider')
    expect(hue(container).getAttribute('aria-label')).toBe('Hue')
    expect(container.querySelector('[data-iris-color-picker-swatch]')).not.toBeNull()
    expect(hexInput(container).getAttribute('aria-label')).toBe('Hex')
  })

  it('reflects the initial color in field, slider values, cursor, and swatch', () => {
    const { container } = render(IrisColorPicker, { props: { value: '#00ff00' } })
    const swatch = container.querySelector('[data-iris-color-picker-swatch]') as HTMLElement
    const hueCursor = hue(container).firstElementChild as HTMLElement

    expect(hexInput(container).value).toBe('#00ff00')
    expect(hue(container).getAttribute('aria-valuenow')).toBe('120')
    expect(saturation(container).getAttribute('aria-valuenow')).toBe('100')
    expect(saturation(container).getAttribute('aria-valuetext')).toContain('100% brightness')
    expect(Number.parseFloat(hueCursor.style.left)).toBeCloseTo(100 / 3, 4)
    expect(swatch.style.background).toBe('rgb(0, 255, 0)')
  })

  it('renders caller presets with accessible labels', () => {
    const presets = ['#ff0000', '#00ff00', '#0000ff']
    const { container } = render(IrisColorPicker, { props: { presets } })
    const buttons = container.querySelectorAll<HTMLButtonElement>(
      '[data-iris-color-picker-presets] button',
    )

    expect(buttons).toHaveLength(3)
    expect([...buttons].map((button) => button.getAttribute('aria-label'))).toEqual(presets)
  })

  it('omits the preset group when presets is empty', () => {
    const { container } = render(IrisColorPicker, { props: { presets: [] } })

    expect(container.querySelector('[data-iris-color-picker-presets]')).toBeNull()
  })

  it('accepts a valid hex input and emits its normalized value', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisColorPicker, {
      props: { value: '#000000', onValueChange },
    })
    flushSync()
    onValueChange.mockClear()

    await fireEvent.input(hexInput(container), { target: { value: '#00FF00' } })
    flushSync()

    expect(hexInput(container).value).toBe('#00ff00')
    expect(onValueChange).toHaveBeenLastCalledWith('#00ff00')
    expect(hue(container).getAttribute('aria-valuenow')).toBe('120')
  })

  it('keeps an incomplete hex draft without changing the selected color', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisColorPicker, {
      props: { value: '#3366cc', onValueChange },
    })
    flushSync()
    onValueChange.mockClear()
    const swatch = container.querySelector('[data-iris-color-picker-swatch]') as HTMLElement
    const before = swatch.style.background

    await fireEvent.input(hexInput(container), { target: { value: '#12' } })
    flushSync()

    expect(hexInput(container).value).toBe('#12')
    expect(swatch.style.background).toBe(before)
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('applies a preset and reports the exact preset value', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisColorPicker, {
      props: { value: '#000000', presets: ['#123456'], onValueChange },
    })
    flushSync()
    onValueChange.mockClear()

    await fireEvent.click(
      container.querySelector('[data-iris-color-picker-presets] button') as HTMLButtonElement,
    )
    flushSync()

    expect(onValueChange).toHaveBeenCalled()
    expect(onValueChange).toHaveBeenLastCalledWith('#123456')
    expect(hexInput(container).value).toBe('#123456')
  })

  it('moves hue with arrow keys and exposes the new accessible value', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisColorPicker, {
      props: { value: '#ff0000', onValueChange },
    })
    flushSync()
    onValueChange.mockClear()

    await fireEvent.keyDown(hue(container), { key: 'ArrowRight' })
    flushSync()

    expect(hue(container).getAttribute('aria-valuenow')).toBe('10')
    expect(onValueChange).toHaveBeenLastCalledWith('#ff2a00')

    await fireEvent.keyDown(hue(container), { key: 'ArrowDown', shiftKey: true })
    flushSync()
    expect(hue(container).getAttribute('aria-valuenow')).toBe('9')
  })

  it('supports Home and End hue keyboard boundaries', async () => {
    const { container } = render(IrisColorPicker, { props: { value: '#00ff00' } })

    await fireEvent.keyDown(hue(container), { key: 'End' })
    flushSync()
    expect(hue(container).getAttribute('aria-valuenow')).toBe('360')

    await fireEvent.keyDown(hue(container), { key: 'Home' })
    flushSync()
    expect(hue(container).getAttribute('aria-valuenow')).toBe('0')
  })

  it('adjusts saturation and brightness independently from the keyboard', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisColorPicker, {
      props: { value: '#ff0000', onValueChange },
    })
    flushSync()
    onValueChange.mockClear()

    await fireEvent.keyDown(saturation(container), { key: 'ArrowLeft', shiftKey: true })
    flushSync()
    expect(saturation(container).getAttribute('aria-valuenow')).toBe('90')
    expect(saturation(container).getAttribute('aria-valuetext')).toContain('100% brightness')

    await fireEvent.keyDown(saturation(container), { key: 'ArrowDown' })
    flushSync()
    expect(saturation(container).getAttribute('aria-valuenow')).toBe('90')
    expect(saturation(container).getAttribute('aria-valuetext')).toContain('99% brightness')
    expect(onValueChange).toHaveBeenCalledTimes(2)
  })

  it('ignores unrelated slider keys without emitting', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisColorPicker, {
      props: { value: '#ff0000', onValueChange },
    })
    flushSync()
    onValueChange.mockClear()

    await fireEvent.keyDown(hue(container), { key: 'PageDown' })
    await fireEvent.keyDown(saturation(container), { key: 'Enter' })
    flushSync()

    expect(onValueChange).not.toHaveBeenCalled()
    expect(hue(container).getAttribute('aria-valuenow')).toBe('0')
    expect(saturation(container).getAttribute('aria-valuenow')).toBe('100')
  })

  it('maps saturation/value pointer coordinates into a color', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisColorPicker, {
      props: { value: '#000000', onValueChange },
    })
    flushSync()
    onValueChange.mockClear()
    setRect(saturation(container), 200, 100)

    await fireEvent.mouseDown(saturation(container), { clientX: 100, clientY: 0 })
    flushSync()
    await fireEvent.pointerUp(document)

    expect(saturation(container).getAttribute('aria-valuenow')).toBe('50')
    expect(saturation(container).getAttribute('aria-valuetext')).toContain('100% brightness')
    expect(onValueChange).toHaveBeenLastCalledWith('#ff8080')
  })

  it('maps hue pointer coordinates across the full strip', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisColorPicker, {
      props: { value: '#ff0000', onValueChange },
    })
    flushSync()
    onValueChange.mockClear()
    setRect(hue(container), 200, 12)

    await fireEvent.mouseDown(hue(container), { clientX: 100, clientY: 6 })
    flushSync()
    await fireEvent.pointerUp(document)

    expect(hue(container).getAttribute('aria-valuenow')).toBe('180')
    expect(onValueChange).toHaveBeenLastCalledWith('#00ffff')
  })

  it('disabled state removes sliders from tab order and blocks all updates', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisColorPicker, {
      props: {
        value: '#ff0000',
        disabled: true,
        presets: ['#00ff00'],
        onValueChange,
      },
    })
    flushSync()
    onValueChange.mockClear()

    const root = container.querySelector('[data-iris-color-picker]') as HTMLElement
    const preset = container.querySelector(
      '[data-iris-color-picker-presets] button',
    ) as HTMLButtonElement
    expect(root.hasAttribute('data-disabled')).toBe(true)
    expect(saturation(container).tabIndex).toBe(-1)
    expect(hue(container).tabIndex).toBe(-1)
    expect(saturation(container).getAttribute('aria-disabled')).toBe('true')
    expect(hue(container).getAttribute('aria-disabled')).toBe('true')
    expect(hexInput(container).disabled).toBe(true)
    expect(preset.disabled).toBe(true)

    await fireEvent.keyDown(hue(container), { key: 'ArrowRight' })
    await fireEvent.click(preset)
    flushSync()
    expect(onValueChange).not.toHaveBeenCalled()
    expect(hue(container).getAttribute('aria-valuenow')).toBe('0')
  })

  it('forwards root attributes, class, and custom style', () => {
    const { container } = render(IrisColorPicker, {
      props: {
        class: 'brand-color',
        style: 'margin-block-start: 6px',
        'data-testid': 'brand-color',
      },
    })
    const root = container.querySelector('[data-iris-color-picker]') as HTMLElement

    expect(root.classList.contains('brand-color')).toBe(true)
    expect(root.getAttribute('data-testid')).toBe('brand-color')
    expect(root.style.marginBlockStart).toBe('6px')
  })

  it('reflects controlled value changes after rerender', async () => {
    const onValueChange = vi.fn()
    const { container, rerender } = render(IrisColorPicker, {
      props: { value: '#ff0000', onValueChange },
    })
    flushSync()
    onValueChange.mockClear()

    await rerender({ value: '#0000ff', onValueChange })
    flushSync()

    expect(hexInput(container).value).toBe('#0000ff')
    expect(hue(container).getAttribute('aria-valuenow')).toBe('240')
    expect(onValueChange).toHaveBeenLastCalledWith('#0000ff')
  })
})
