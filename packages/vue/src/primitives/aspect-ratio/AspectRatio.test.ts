import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisAspectRatio } from './AspectRatio'

describe('IrisAspectRatio', () => {
  it('applies the default 16/9 ratio', () => {
    const w = mount(IrisAspectRatio)
    expect(w.find('[data-iris-aspect-ratio]').attributes('data-ratio')).toBe(String(16 / 9))
  })

  it('applies a custom ratio', () => {
    const w = mount(IrisAspectRatio, { props: { ratio: 1.5 } })
    expect(w.find('[data-iris-aspect-ratio]').attributes('data-ratio')).toBe('1.5')
  })

  it('renders slot content in the content layer', () => {
    const w = mount(IrisAspectRatio, { slots: { default: '<span data-child="">X</span>' } })
    expect(w.find('[data-iris-aspect-ratio-content] [data-child]').text()).toBe('X')
  })
})
