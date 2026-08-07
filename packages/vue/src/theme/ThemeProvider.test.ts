import { afterEach, describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'
import { createThemeStore } from '@iris-ui-kit/theme'
import { ThemeProvider } from './ThemeProvider'

afterEach(() => {
  document.documentElement.removeAttribute('style')
  document.documentElement.removeAttribute('data-iris-theme')
  document.documentElement.removeAttribute('data-iris-theme-type')
  document.documentElement.removeAttribute('dir')
  document.documentElement.removeAttribute('data-iris-dir')
})

const makeStore = () =>
  createThemeStore({ themes: { light: lightTheme, dark: darkTheme }, default: 'light' })

describe('ThemeProvider (Vue)', () => {
  it('re-scopes theme + dir to the new target on target swap', async () => {
    const el1 = document.createElement('div')
    const el2 = document.createElement('div')
    const store = makeStore()
    const wrapper = mount(ThemeProvider, {
      props: { store, target: el1, dir: 'rtl' },
      slots: { default: () => h('span') },
    })
    await nextTick()

    // el1 is themed, el2 and documentElement are untouched
    expect(el1.getAttribute('data-iris-theme')).toBe('iris-light')
    expect(el1.getAttribute('data-iris-theme-type')).not.toBeNull()
    expect(el1.style.getPropertyValue('--iris-background')).toBe(
      lightTheme.colors['iris.background'],
    )
    expect(el1.getAttribute('dir')).toBe('rtl')
    expect(el1.getAttribute('data-iris-dir')).toBe('rtl')
    expect(el2.getAttribute('data-iris-theme')).toBeNull()
    expect(el2.style.getPropertyValue('--iris-background')).toBe('')
    expect(el2.getAttribute('dir')).toBeNull()
    expect(document.documentElement.getAttribute('data-iris-theme')).toBeNull()

    await wrapper.setProps({ target: el2 })

    // old target reverted, new target themed
    expect(el1.getAttribute('data-iris-theme')).toBeNull()
    expect(el1.style.getPropertyValue('--iris-background')).toBe('')
    expect(el1.getAttribute('dir')).toBeNull()
    expect(el2.getAttribute('data-iris-theme')).toBe('iris-light')
    expect(el2.style.getPropertyValue('--iris-background')).toBe(
      lightTheme.colors['iris.background'],
    )
    expect(el2.getAttribute('dir')).toBe('rtl')

    // a theme change after the swap lands on the new target, old stays clean
    store.setTheme('dark')
    await nextTick()
    expect(el2.getAttribute('data-iris-theme')).toBe('iris-dark')
    expect(el1.getAttribute('data-iris-theme')).toBeNull()
    expect(el1.style.getPropertyValue('--iris-background')).toBe('')

    // unmount reverts the post-swap element; the original stays clean
    wrapper.unmount()
    expect(el2.getAttribute('data-iris-theme')).toBeNull()
    expect(el2.getAttribute('dir')).toBeNull()
    expect(el2.style.getPropertyValue('--iris-background')).toBe('')
    expect(el1.getAttribute('data-iris-theme')).toBeNull()
  })

  it('resubscribes to the new store on store swap and drops the old subscription', async () => {
    const store1 = makeStore()
    const store2 = makeStore()
    const wrapper = mount(ThemeProvider, {
      props: { store: store1 },
      slots: { default: () => h('span') },
    })
    await nextTick()
    expect(document.documentElement.getAttribute('data-iris-theme')).toBe('iris-light')

    await wrapper.setProps({ store: store2 })
    // swapping two light stores is a visual no-op
    expect(document.documentElement.getAttribute('data-iris-theme')).toBe('iris-light')

    // mutating the OLD store must no longer reach the DOM (dropped subscription)
    store1.setTheme('dark')
    await nextTick()
    expect(document.documentElement.style.getPropertyValue('--iris-background')).toBe(
      lightTheme.colors['iris.background'],
    )
    expect(document.documentElement.getAttribute('data-iris-theme')).toBe('iris-light')

    // the NEW store drives the DOM
    store2.setTheme('dark')
    await nextTick()
    expect(document.documentElement.style.getPropertyValue('--iris-background')).toBe(
      darkTheme.colors['iris.background'],
    )
    expect(document.documentElement.getAttribute('data-iris-theme')).toBe('iris-dark')

    // no dangling subscription after unmount: the DOM was reverted at unmount
    // and post-swap store changes must not re-apply it
    wrapper.unmount()
    expect(document.documentElement.getAttribute('data-iris-theme')).toBeNull()
    store2.setTheme('light')
    await nextTick()
    expect(document.documentElement.getAttribute('data-iris-theme')).toBeNull()
    expect(document.documentElement.style.getPropertyValue('--iris-background')).toBe('')
  })

  it('seeds current from the new store on store swap', async () => {
    const store1 = makeStore()
    const store2 = makeStore()
    store2.setTheme('dark')
    const wrapper = mount(ThemeProvider, {
      props: { store: store1 },
      slots: { default: () => h('span') },
    })
    await nextTick()
    expect(document.documentElement.getAttribute('data-iris-theme')).toBe('iris-light')

    await wrapper.setProps({ store: store2 })
    // the swapped-in store's state is applied even without a setTheme call
    expect(document.documentElement.getAttribute('data-iris-theme')).toBe('iris-dark')
    expect(document.documentElement.style.getPropertyValue('--iris-background')).toBe(
      darkTheme.colors['iris.background'],
    )
    wrapper.unmount()
  })
})
