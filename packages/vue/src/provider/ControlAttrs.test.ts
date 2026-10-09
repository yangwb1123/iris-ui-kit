import { mount } from '@vue/test-utils'
import { h, type StyleValue } from 'vue'
import { normalizeHostStyle } from '../internal/control-attrs'
import { describe, expect, it } from 'vitest'
import { IrisInput } from '../primitives/input/Input'
import { IrisNumberInput } from '../primitives/number-input/NumberInput'
import { IrisSwitch } from '../primitives/switch/Switch'

const probes = [
  () => mount(IrisInput, { attrs: { style: { width: '224px' }, 'aria-label': 'field' } }),
  () => mount(IrisNumberInput, { attrs: { style: { width: '224px' }, 'aria-label': 'field' } }),
  () => mount(IrisSwitch, { attrs: { style: { width: '224px' }, 'aria-label': 'field' } }),
]

describe('native control attributes', () => {
  it.each([
    'width: 224px; min-height: 72px',
    [{ width: '100px' }, 'width: 224px', { minHeight: '72px' }],
  ] satisfies StyleValue[])('preserves string/array host-style precedence', (style) => {
    for (const control of [IrisInput, IrisNumberInput, IrisSwitch]) {
      const wrapper = mount(() => h(control, { style, 'aria-label': 'field' }))
      expect(wrapper.get('input').attributes('aria-label')).toBe('field')
      expect(wrapper.get('input').attributes('style')).not.toContain('224px')
      expect((wrapper.element as HTMLElement).style.width).toBe('224px')
      expect((wrapper.element as HTMLElement).style.minHeight).toBe('72px')
      wrapper.unmount()
    }
  })

  it('normalizes mixed styles in caller order without numeric array keys', () => {
    expect(normalizeHostStyle([{ width: '100px' }, 'width: 224px; --iris-primary: red'])).toEqual({
      width: '224px',
      '--iris-primary': 'red',
    })
  })
  it.each(probes)('keeps custom host styles while naming the native input', (render) => {
    const wrapper = render()
    expect(wrapper.attributes('style')).toContain('width: 224px')
    expect(wrapper.attributes('aria-label')).toBeUndefined()
    expect(wrapper.get('input').attributes('aria-label')).toBe('field')
    expect(wrapper.get('input').attributes('style')).not.toContain('width: 224px')
    wrapper.unmount()
  })
})
