import { afterEach, describe, it, expect } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createSkinEngine, type Skin } from '@iris-ui-kit/skins'
import { SkinProvider } from './SkinProvider'
import { useSkin } from './useSkin'

afterEach(() => {
  document.documentElement.removeAttribute('style')
  document.documentElement.removeAttribute('data-iris-skin')
  document.documentElement.removeAttribute('data-iris-skin-type')
})

const brand: Skin = { id: 'brand', extends: 'dark', tokens: { 'iris.primary': '#abc' } }

const Probe = defineComponent({
  setup() {
    const { skin, setSkin } = useSkin()
    return () =>
      h(
        'button',
        { onClick: () => setSkin('brand'), 'data-testid': 'b' },
        `${skin.value.id}:${skin.value.theme.colors['iris.primary']}`,
      )
  },
})

describe('SkinProvider / useSkin (Vue)', () => {
  it('provides the current skin and switches on setSkin', async () => {
    const engine = createSkinEngine({ skins: [brand], default: 'light' })
    const wrapper = mount(SkinProvider, {
      props: { engine },
      slots: { default: () => h(Probe) },
    })
    expect(wrapper.get('[data-testid="b"]').text()).toContain('light')
    await wrapper.get('[data-testid="b"]').trigger('click')
    expect(wrapper.get('[data-testid="b"]').text()).toContain('brand:#abc')
    wrapper.unmount()
  })

  it('applies skin vars to documentElement and reverts on unmount', () => {
    const engine = createSkinEngine({ skins: [brand], default: 'brand' })
    const wrapper = mount(SkinProvider, { props: { engine }, slots: { default: () => h('span') } })
    expect(document.documentElement.getAttribute('data-iris-skin')).toBe('brand')
    wrapper.unmount()
    expect(document.documentElement.getAttribute('data-iris-skin')).toBeNull()
  })

  it('re-applies the skin to the new target on target swap (parity with react/solid/svelte)', async () => {
    const engine = createSkinEngine({ skins: [brand], default: 'light' })
    const el1 = document.createElement('div')
    const el2 = document.createElement('div')
    document.body.append(el1, el2)
    try {
      const wrapper = mount(SkinProvider, {
        props: { engine, target: el1 },
        slots: { default: () => h(Probe) },
      })
      expect(el1.getAttribute('data-iris-skin')).toBe('light')
      expect(el1.style.getPropertyValue('--iris-primary')).not.toBe('')

      await wrapper.setProps({ target: el2 })
      // old target reverted, new target applied
      expect(el1.getAttribute('data-iris-skin')).toBeNull()
      expect(el1.style.getPropertyValue('--iris-primary')).toBe('')
      expect(el2.getAttribute('data-iris-skin')).toBe('light')
      expect(el2.style.getPropertyValue('--iris-primary')).not.toBe('')

      // setSkin after a swap lands on the new target, old target stays clean
      await wrapper.get('[data-testid="b"]').trigger('click')
      expect(el2.getAttribute('data-iris-skin')).toBe('brand')
      expect(el2.style.getPropertyValue('--iris-primary')).toBe('#abc')
      expect(el1.getAttribute('data-iris-skin')).toBeNull()
      expect(el1.style.getPropertyValue('--iris-primary')).toBe('')
      wrapper.unmount()
    } finally {
      el1.remove()
      el2.remove()
    }
  })

  it('reverts the post-swap target on unmount', async () => {
    const engine = createSkinEngine({ skins: [brand], default: 'brand' })
    const el1 = document.createElement('div')
    const el2 = document.createElement('div')
    document.body.append(el1, el2)
    try {
      const wrapper = mount(SkinProvider, {
        props: { engine, target: el1 },
        slots: { default: () => h('span') },
      })
      await wrapper.setProps({ target: el2 })
      expect(el2.getAttribute('data-iris-skin')).toBe('brand')

      wrapper.unmount()
      // the post-swap element is reverted, the original stays clean
      expect(el2.getAttribute('data-iris-skin')).toBeNull()
      expect(el2.style.getPropertyValue('--iris-primary')).toBe('')
      expect(el1.getAttribute('data-iris-skin')).toBeNull()
    } finally {
      el1.remove()
      el2.remove()
    }
  })
})
