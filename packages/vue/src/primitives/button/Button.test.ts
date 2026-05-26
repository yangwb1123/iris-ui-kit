import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisButton } from './Button'
import { __BUTTON_STYLE_ID, __resetButtonStyles, installButtonStyles } from './styles'

describe('IrisButton', () => {
  beforeEach(() => {
    __resetButtonStyles()
  })

  afterEach(() => {
    __resetButtonStyles()
  })

  it('renders a native <button>', () => {
    const wrapper = mount(IrisButton, { slots: { default: () => 'Click' } })
    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.text()).toBe('Click')
  })

  it('defaults type to "button" (guards against accidental form submit)', () => {
    const wrapper = mount(IrisButton)
    expect(wrapper.attributes('type')).toBe('button')
  })

  it('respects explicit type="submit"', () => {
    const wrapper = mount(IrisButton, { props: { type: 'submit' } })
    expect(wrapper.attributes('type')).toBe('submit')
  })

  it('emits click when interactive', async () => {
    const wrapper = mount(IrisButton)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('does not emit click when disabled', async () => {
    const wrapper = mount(IrisButton, { props: { disabled: true } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('does not emit click when loading', async () => {
    const wrapper = mount(IrisButton, { props: { loading: true } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('sets aria-busy and disabled attribute when loading', () => {
    const wrapper = mount(IrisButton, { props: { loading: true } })
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.attributes('disabled')).toBeDefined()
  })

  it('sets aria-disabled and disabled attribute when disabled', () => {
    const wrapper = mount(IrisButton, { props: { disabled: true } })
    expect(wrapper.attributes('aria-disabled')).toBe('true')
    expect(wrapper.attributes('disabled')).toBeDefined()
  })

  it('renders the leading slot when not loading', () => {
    const wrapper = mount(IrisButton, {
      slots: {
        default: () => 'Save',
        leading: () => h('span', { class: 'icon-test' }, 'i'),
      },
    })
    expect(wrapper.find('.icon-test').exists()).toBe(true)
    expect(wrapper.find('.iris-button-spinner').exists()).toBe(false)
  })

  it('replaces leading slot with spinner when loading', () => {
    const wrapper = mount(IrisButton, {
      props: { loading: true },
      slots: {
        default: () => 'Save',
        leading: () => h('span', { class: 'icon-test' }, 'i'),
      },
    })
    expect(wrapper.find('.icon-test').exists()).toBe(false)
    expect(wrapper.find('.iris-button-spinner').exists()).toBe(true)
  })

  it('applies variant via data attribute', () => {
    const wrapper = mount(IrisButton, { props: { variant: 'outline' } })
    expect(wrapper.attributes('data-iris-button-variant')).toBe('outline')
  })

  it('applies size via data attribute', () => {
    const wrapper = mount(IrisButton, { props: { size: 'lg' } })
    expect(wrapper.attributes('data-iris-button-size')).toBe('lg')
  })

  it('inline style references CSS variables for solid variant', () => {
    const wrapper = mount(IrisButton, { props: { variant: 'solid' } })
    const style = wrapper.attributes('style') ?? ''
    expect(style).toContain('var(--iris-primary)')
    expect(style).toContain('var(--iris-primary-foreground)')
  })

  it('inline style differs across variants', () => {
    const solid = mount(IrisButton, { props: { variant: 'solid' } }).attributes('style')
    const outline = mount(IrisButton, { props: { variant: 'outline' } }).attributes('style')
    const ghost = mount(IrisButton, { props: { variant: 'ghost' } }).attributes('style')
    const link = mount(IrisButton, { props: { variant: 'link' } }).attributes('style')
    const set = new Set([solid, outline, ghost, link])
    expect(set.size).toBe(4)
  })

  it('link variant zeroes out padding', () => {
    const wrapper = mount(IrisButton, { props: { variant: 'link' } })
    const style = wrapper.attributes('style') ?? ''
    expect(style).toMatch(/padding:\s*0(?:px)?(?:\s*;|$)/)
  })

  it('installs styles only once across multiple mounts', () => {
    mount(IrisButton)
    mount(IrisButton)
    mount(IrisButton)
    expect(document.querySelectorAll(`#${__BUTTON_STYLE_ID}`)).toHaveLength(1)
  })

  it('installButtonStyles short-circuits without document (SSR safety)', () => {
    __resetButtonStyles()
    const orig = globalThis.document
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      get: () => undefined,
    })
    try {
      expect(() => installButtonStyles()).not.toThrow()
    } finally {
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: orig,
        writable: true,
      })
    }
  })

  it('parent click handler is not invoked when disabled', async () => {
    let count = 0
    const wrapper = mount(IrisButton, {
      props: { disabled: true, onClick: () => count++ },
    })
    await wrapper.trigger('click')
    expect(count).toBe(0)
  })

  it('parent click handler is not invoked when loading', async () => {
    let count = 0
    const wrapper = mount(IrisButton, {
      props: { loading: true, onClick: () => count++ },
    })
    await wrapper.trigger('click')
    expect(count).toBe(0)
  })

  describe('asChild', () => {
    it('renders the slot root element instead of <button>', () => {
      const wrapper = mount(IrisButton, {
        props: { asChild: true },
        slots: { default: () => h('a', { href: '/save' }, 'Save') },
      })
      expect(wrapper.element.tagName).toBe('A')
      expect(wrapper.attributes('href')).toBe('/save')
    })

    it('merges class onto the slot root', () => {
      const wrapper = mount(IrisButton, {
        props: { asChild: true },
        slots: { default: () => h('a', { class: 'custom-link' }, 'go') },
      })
      const cls = wrapper.attributes('class') ?? ''
      expect(cls).toContain('iris-button')
      expect(cls).toContain('custom-link')
    })

    it('forwards data attributes onto the slot root', () => {
      const wrapper = mount(IrisButton, {
        props: { asChild: true, variant: 'outline', size: 'lg' },
        slots: { default: () => h('a', { href: '#' }, 'go') },
      })
      expect(wrapper.attributes('data-iris-button-variant')).toBe('outline')
      expect(wrapper.attributes('data-iris-button-size')).toBe('lg')
    })

    it('composes click handlers — both child and parent fire', async () => {
      let parentCount = 0
      let childCount = 0
      const wrapper = mount(IrisButton, {
        props: { asChild: true, onClick: () => parentCount++ },
        slots: { default: () => h('a', { onClick: () => childCount++ }, 'go') },
      })
      await wrapper.trigger('click')
      expect(parentCount).toBe(1)
      expect(childCount).toBe(1)
    })

    it('still swallows clicks when disabled in as-child mode', async () => {
      let count = 0
      const wrapper = mount(IrisButton, {
        props: { asChild: true, disabled: true, onClick: () => count++ },
        slots: { default: () => h('a', { onClick: () => count++ }, 'go') },
      })
      await wrapper.trigger('click')
      expect(count).toBe(0)
    })

    it('warns when as-child is used without a child element', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mount(IrisButton, { props: { asChild: true } })
      expect(warn).toHaveBeenCalled()
      const msg = warn.mock.calls[0]?.[0] ?? ''
      expect(String(msg)).toContain('as-child requires')
      warn.mockRestore()
    })
  })
})
