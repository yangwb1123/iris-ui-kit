import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createThemeStore } from '@iris-ui/theme'
import { darkTheme, lightTheme } from '@iris-ui/tokens'
import { ThemeProvider, useDirection } from './ThemeProvider'

afterEach(() => {
  document.documentElement.removeAttribute('dir')
  document.documentElement.removeAttribute('data-iris-dir')
})

function makeStore() {
  return createThemeStore({ themes: { light: lightTheme, dark: darkTheme }, default: 'light' })
}

const DirProbe = defineComponent({
  setup() {
    const dir = useDirection()
    return () => h('span', { class: 'dir' }, dir.value)
  },
})

function harness(dir?: 'ltr' | 'rtl', target?: HTMLElement) {
  return defineComponent({
    setup() {
      return () =>
        h(ThemeProvider, { store: makeStore(), target, dir }, { default: () => h(DirProbe) })
    },
  })
}

describe('@iris-ui/vue ThemeProvider dir / useDirection', () => {
  it('defaults to ltr', () => {
    const target = document.createElement('div')
    const wrapper = mount(harness(undefined, target), { attachTo: document.body })
    expect(wrapper.find('.dir').text()).toBe('ltr')
    wrapper.unmount()
  })

  it('applies dir="rtl" to the target and exposes it via useDirection', () => {
    const target = document.createElement('div')
    const wrapper = mount(harness('rtl', target), { attachTo: document.body })
    expect(target.getAttribute('dir')).toBe('rtl')
    expect(target.getAttribute('data-iris-dir')).toBe('rtl')
    expect(wrapper.find('.dir').text()).toBe('rtl')
    wrapper.unmount()
  })

  it('useDirection returns ltr with no provider', () => {
    const wrapper = mount(DirProbe)
    expect(wrapper.find('.dir').text()).toBe('ltr')
  })
})
