import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisColorPicker } from './ColorPicker'
import { hexToRgba, hsvToRgb, rgbToHex, rgbToHsv } from './colorUtils'

afterEach(() => {})

describe('@iris-ui/vue colorUtils', () => {
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

describe('@iris-ui/vue IrisColorPicker', () => {
  it('renders pad + hue strip + hex/RGB inputs', () => {
    const wrap = mount(IrisColorPicker, { props: { modelValue: '#ff0000' } })
    expect(wrap.find('[data-iris-color-picker-pad]').exists()).toBe(true)
    expect(wrap.find('[data-iris-color-picker-hue]').exists()).toBe(true)
    expect(wrap.find('[data-iris-color-picker-hex]').exists()).toBe(true)
    expect(wrap.find('[data-iris-color-picker-r]').exists()).toBe(true)
    expect(wrap.find('[data-iris-color-picker-g]').exists()).toBe(true)
    expect(wrap.find('[data-iris-color-picker-b]').exists()).toBe(true)
  })

  it('hex input value reflects modelValue', () => {
    const wrap = mount(IrisColorPicker, { props: { modelValue: '#3366cc' } })
    const hex = wrap.find('[data-iris-color-picker-hex]').element as HTMLInputElement
    expect(hex.value).toBe('#3366cc')
  })

  it('RGB inputs reflect modelValue channels', () => {
    const wrap = mount(IrisColorPicker, { props: { modelValue: '#3366cc' } })
    expect((wrap.find('[data-iris-color-picker-r]').element as HTMLInputElement).value).toBe('51')
    expect((wrap.find('[data-iris-color-picker-g]').element as HTMLInputElement).value).toBe('102')
    expect((wrap.find('[data-iris-color-picker-b]').element as HTMLInputElement).value).toBe('204')
  })

  it('changing the hex input emits update:modelValue', async () => {
    const wrap = mount(IrisColorPicker, { props: { modelValue: '#000000' } })
    const hex = wrap.find('[data-iris-color-picker-hex]').element as HTMLInputElement
    hex.value = '#ff8000'
    await wrap.find('[data-iris-color-picker-hex]').trigger('change')
    const emit = wrap.emitted('update:modelValue')!
    expect(emit[0]![0]).toBe('#ff8000')
  })

  it('changing R input emits a new hex', async () => {
    const wrap = mount(IrisColorPicker, { props: { modelValue: '#000000' } })
    const r = wrap.find('[data-iris-color-picker-r]').element as HTMLInputElement
    r.value = '255'
    await wrap.find('[data-iris-color-picker-r]').trigger('input')
    const emit = wrap.emitted('update:modelValue')!
    expect(emit.at(-1)![0]).toBe('#ff0000')
  })

  it('showAlpha=true renders alpha strip + alpha input', () => {
    const wrap = mount(IrisColorPicker, { props: { showAlpha: true, modelValue: '#00000080' } })
    expect(wrap.find('[data-iris-color-picker-alpha]').exists()).toBe(true)
    expect(wrap.find('[data-iris-color-picker-a]').exists()).toBe(true)
  })

  it('showAlpha=false hides alpha strip + input', () => {
    const wrap = mount(IrisColorPicker, { props: { showAlpha: false } })
    expect(wrap.find('[data-iris-color-picker-alpha]').exists()).toBe(false)
    expect(wrap.find('[data-iris-color-picker-a]').exists()).toBe(false)
  })

  it('disabled sets data-disabled on root', () => {
    const wrap = mount(IrisColorPicker, { props: { disabled: true } })
    expect(wrap.find('[data-iris-color-picker]').attributes('data-disabled')).toBe('true')
  })

  it('disabled blocks RGB input changes', async () => {
    const wrap = mount(IrisColorPicker, { props: { modelValue: '#000000', disabled: true } })
    expect((wrap.find('[data-iris-color-picker-r]').element as HTMLInputElement).disabled).toBe(
      true,
    )
  })

  it('cursor position on pad reflects s and v', () => {
    const wrap = mount(IrisColorPicker, { props: { modelValue: '#3366cc' } })
    const cursor = wrap.find('[data-iris-color-picker-pad-cursor]')
    const style = cursor.attributes('style') || ''
    // Some percent for left and top.
    expect(style).toMatch(/left:\s*\d/)
    expect(style).toMatch(/top:\s*\d/)
  })
})
