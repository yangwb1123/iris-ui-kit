import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisDivider } from './Divider'

describe('IrisDivider', () => {
  it('renders an <hr> for plain horizontal', () => {
    const w = mount(IrisDivider)
    expect(w.element.tagName).toBe('HR')
    expect(w.attributes('data-iris-divider-orientation')).toBe('horizontal')
  })

  it('vertical renders a div with aria-orientation="vertical"', () => {
    const w = mount(IrisDivider, { props: { orientation: 'vertical' } })
    expect(w.element.tagName).toBe('DIV')
    expect(w.attributes('role')).toBe('separator')
    expect(w.attributes('aria-orientation')).toBe('vertical')
  })

  it('label prop renders text + two lines', () => {
    const w = mount(IrisDivider, { props: { label: 'or' } })
    expect(w.element.tagName).toBe('DIV')
    expect(w.find('[data-iris-divider-label]').text()).toBe('or')
    expect(w.find('[data-iris-divider-line="before"]').exists()).toBe(true)
    expect(w.find('[data-iris-divider-line="after"]').exists()).toBe(true)
  })

  it('label slot wins over the label prop', () => {
    const w = mount(IrisDivider, { props: { label: 'prop' }, slots: { default: 'slot' } })
    expect(w.find('[data-iris-divider-label]').text()).toBe('slot')
  })

  it('spacing sm/md/lg applies different margins', () => {
    expect(mount(IrisDivider, { props: { spacing: 'sm' } }).attributes('style')).toContain(
      'margin: 8px 0',
    )
    expect(mount(IrisDivider, { props: { spacing: 'md' } }).attributes('style')).toContain(
      'margin: 16px 0',
    )
    expect(mount(IrisDivider, { props: { spacing: 'lg' } }).attributes('style')).toContain(
      'margin: 24px 0',
    )
  })

  it('vertical applies horizontal margins', () => {
    const w = mount(IrisDivider, { props: { orientation: 'vertical', spacing: 'sm' } })
    // jsdom normalizes shorthand "0 8px" to "0px 8px"; accept either form.
    const style = w.attributes('style') ?? ''
    expect(/margin:\s*0(px)?\s+8px/.test(style)).toBe(true)
  })

  it('labelled horizontal has role="separator" + aria-orientation="horizontal"', () => {
    const w = mount(IrisDivider, { props: { label: 'OR' } })
    expect(w.attributes('role')).toBe('separator')
    expect(w.attributes('aria-orientation')).toBe('horizontal')
  })
})
