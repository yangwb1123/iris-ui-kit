import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'
import ThemeProvider from './ThemeProvider.svelte'
import ThemeHarness from './ThemeHarness.svelte'
import ThemeOptionalProbe from './ThemeOptionalProbe.svelte'
import type { UseThemeReturn } from './useTheme'

afterEach(cleanup)

function makeStore() {
  return createThemeStore({ themes: { light: lightTheme, dark: darkTheme }, default: 'light' })
}

describe('@iris-ui-kit/svelte theme', () => {
  it('applies CSS vars to document.documentElement and reverts on unmount', () => {
    const { unmount } = render(ThemeProvider, { props: { store: makeStore() } })
    expect(document.documentElement.style.getPropertyValue('--iris-background')).toBeTruthy()
    unmount()
    expect(document.documentElement.style.getPropertyValue('--iris-background')).toBe('')
  })

  it('provides the active theme and switches reactively via setTheme', () => {
    let api: UseThemeReturn | undefined
    const { container } = render(ThemeHarness, {
      props: {
        store: makeStore(),
        onready: (a: UseThemeReturn) => {
          api = a
        },
      },
    })
    expect(container.querySelector('[data-name]')?.textContent).toBe(lightTheme.name)
    api!.setTheme('dark')
    flushSync()
    expect(container.querySelector('[data-name]')?.textContent).toBe(darkTheme.name)
  })

  it('defaults writing direction to ltr inside a provider', () => {
    const { container } = render(ThemeHarness, { props: { store: makeStore() } })
    expect(container.querySelector('[data-dir]')?.textContent).toBe('ltr')
  })

  it('writes the dir attribute to the target for RTL', () => {
    render(ThemeProvider, { props: { store: makeStore(), dir: 'rtl' } })
    expect(document.documentElement.getAttribute('dir')).toBe('rtl')
  })

  it('useThemeOptional() is undefined and useDirection() is ltr without a provider', () => {
    const { container } = render(ThemeOptionalProbe)
    expect(container.querySelector('[data-optional]')?.textContent).toBe('none')
    expect(container.querySelector('[data-dir]')?.textContent).toBe('ltr')
  })
})
