import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisKbd } from './Kbd'

describe('IrisKbd', () => {
  it('renders a single key as a <kbd>', () => {
    const w = mount(IrisKbd, { props: { keys: 'K' } })
    expect(w.findAll('[data-iris-kbd-key]').length).toBe(1)
    expect(w.findAll('[data-iris-kbd-key]')[0]!.text()).toBe('K')
  })

  it('renders multiple keys with separators', () => {
    const w = mount(IrisKbd, { props: { keys: ['Ctrl', 'K'] } })
    const keys = w.findAll('[data-iris-kbd-key]')
    const seps = w.findAll('[data-iris-kbd-separator]')
    expect(keys.length).toBe(2)
    expect(seps.length).toBe(1)
    expect(seps[0]!.text()).toBe('+')
  })

  it('uses a custom separator', () => {
    const w = mount(IrisKbd, { props: { keys: ['⌘', 'K'], separator: '·' } })
    expect(w.find('[data-iris-kbd-separator]').text()).toBe('·')
  })

  it('renders 3+ keys with N-1 separators', () => {
    const w = mount(IrisKbd, { props: { keys: ['Ctrl', 'Shift', 'P'] } })
    expect(w.findAll('[data-iris-kbd-key]').length).toBe(3)
    expect(w.findAll('[data-iris-kbd-separator]').length).toBe(2)
  })

  it('empty keys → renders nothing', () => {
    const w = mount(IrisKbd, { props: { keys: [] } })
    expect(w.find('[data-iris-kbd-key]').exists()).toBe(false)
  })

  it('default slot wins over keys prop', () => {
    const w = mount(IrisKbd, { props: { keys: 'X' }, slots: { default: 'custom' } })
    // With a slot, the root <kbd> directly holds the content.
    expect(w.element.tagName).toBe('KBD')
    expect(w.text()).toBe('custom')
    expect(w.find('[data-iris-kbd-key]').exists()).toBe(false)
  })

  it('size sm changes font size', () => {
    const w = mount(IrisKbd, { props: { keys: 'K', size: 'sm' } })
    expect(w.attributes('style')).toContain('font-size: var(--iris-font-size-xs, 12px)')
  })

  it('exposes data-iris-kbd-size', () => {
    const w = mount(IrisKbd, { props: { keys: 'K', size: 'sm' } })
    expect(w.attributes('data-iris-kbd-size')).toBe('sm')
  })
})
