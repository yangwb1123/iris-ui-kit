import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import IrisColorPicker from './IrisColorPicker.svelte'

describe('IrisColorPicker', () => {
  it('renders without crashing', () => {
    const { container } = render(IrisColorPicker)
    expect(container.querySelector('[data-iris-color-picker]')).toBeTruthy()
  })

  it('renders hue slider', () => {
    const { container } = render(IrisColorPicker)
    expect(container.querySelector('[data-iris-color-picker-hue]')).toBeTruthy()
  })

  it('renders hex input with initial value', () => {
    const { container } = render(IrisColorPicker, { props: { value: '#ff0000' } })
    const input = container.querySelector('[data-iris-color-picker-hex]') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.value).toContain('#')
  })

  it('renders preset swatches', () => {
    const { container } = render(IrisColorPicker, { props: { presets: ['#ff0000', '#00ff00'] } })
    expect(container.querySelector('[data-iris-color-picker-presets]')).toBeTruthy()
    const btns = container.querySelectorAll('[data-iris-color-picker-presets] button')
    expect(btns.length).toBe(2)
  })
})
