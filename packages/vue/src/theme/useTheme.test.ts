import { afterEach, describe, expect, it, beforeEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'
import { createThemeStore } from '@iris-ui-kit/theme'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './useTheme'

const Consumer = defineComponent({
  name: 'Consumer',
  setup() {
    const { theme, setTheme } = useTheme()
    return { theme, setTheme }
  },
  render() {
    return h('div', { class: 'consumer', 'data-theme': this.theme.name })
  },
})

describe('useTheme', () => {
  let store = createThemeStore({
    themes: { light: lightTheme, dark: darkTheme },
    default: 'light',
  })

  beforeEach(() => {
    store = createThemeStore({
      themes: { light: lightTheme, dark: darkTheme },
      default: 'light',
    })
  })

  afterEach(() => {
    document.documentElement.removeAttribute('data-iris-theme')
    document.documentElement.removeAttribute('data-iris-theme-type')
  })

  it('returns the active theme via the provider', async () => {
    const wrapper = mount(ThemeProvider, {
      props: { store },
      slots: { default: () => h(Consumer) },
    })
    await nextTick()
    expect(wrapper.find('.consumer').attributes('data-theme')).toBe('iris-light')
  })

  it('reacts when setTheme is called', async () => {
    const wrapper = mount(ThemeProvider, {
      props: { store },
      slots: { default: () => h(Consumer) },
    })
    await nextTick()
    store.setTheme('dark')
    await nextTick()
    expect(wrapper.find('.consumer').attributes('data-theme')).toBe('iris-dark')
  })

  it('applies CSS variables to documentElement on mount', async () => {
    mount(ThemeProvider, {
      props: { store },
      slots: { default: () => h(Consumer) },
    })
    await nextTick()
    expect(document.documentElement.style.getPropertyValue('--iris-background')).toBe(
      lightTheme.colors['iris.background'],
    )
  })

  it('switches CSS variables when theme changes', async () => {
    mount(ThemeProvider, {
      props: { store },
      slots: { default: () => h(Consumer) },
    })
    await nextTick()
    store.setTheme('dark')
    await nextTick()
    expect(document.documentElement.style.getPropertyValue('--iris-background')).toBe(
      darkTheme.colors['iris.background'],
    )
  })

  it('throws when useTheme is called without a provider', () => {
    expect(() => mount(Consumer)).toThrow()
  })
})
