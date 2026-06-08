import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisColorPicker } from './IrisColorPicker'

afterEach(cleanup)

describe('IrisColorPicker', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisColorPicker />)
    expect(container.querySelector('[data-iris-color-picker]')).not.toBeNull()
  })

  it('renders hue slider and sv gradient', () => {
    const { container } = render(() => <IrisColorPicker />)
    expect(container.querySelector('[data-iris-color-picker-sv]')).not.toBeNull()
    expect(container.querySelector('[data-iris-color-picker-hue]')).not.toBeNull()
  })

  it('renders hex input', () => {
    const { container } = render(() => <IrisColorPicker defaultValue="#ff0000" />)
    const input = container.querySelector('[data-iris-color-picker-hex]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.value.toLowerCase()).toBe('#ff0000')
  })

  it('renders preset swatches', () => {
    const { container } = render(() => (
      <IrisColorPicker presets={['#ff0000', '#00ff00', '#0000ff']} />
    ))
    const presets = container.querySelectorAll('[data-iris-color-picker-preset]')
    expect(presets.length).toBe(3)
  })
})
