import { afterEach, describe, it, expect } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createSkinEngine, type Skin } from '@iris-ui/skins'
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
})
