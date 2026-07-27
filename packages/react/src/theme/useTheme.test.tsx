import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createThemeStore } from '@iris-ui-kit/theme'
import { darkTheme, lightTheme } from '@iris-ui-kit/tokens'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './useTheme'

afterEach(() => {
  cleanup()
  // Reset documentElement style overrides left behind by previous tests.
  document.documentElement.removeAttribute('style')
  document.documentElement.removeAttribute('data-iris-theme')
  document.documentElement.removeAttribute('data-iris-theme-type')
})

function makeStore() {
  return createThemeStore({
    themes: { light: lightTheme, dark: darkTheme },
    default: 'light',
  })
}

function HookHarness() {
  const { theme, setTheme, availableThemes } = useTheme()
  return (
    <div>
      <span data-testid="name">{theme.name}</span>
      <span data-testid="type">{theme.type}</span>
      <span data-testid="count">{Object.keys(availableThemes).length}</span>
      <button data-testid="to-dark" onClick={() => setTheme('dark')}>
        dark
      </button>
      <button data-testid="to-light" onClick={() => setTheme('light')}>
        light
      </button>
    </div>
  )
}

describe('@iris-ui-kit/react useTheme + ThemeProvider', () => {
  it('useTheme without a provider throws', () => {
    const e = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<HookHarness />)).toThrow(/no <ThemeProvider> ancestor/)
    e.mockRestore()
  })

  it('initial theme exposed via useTheme()', () => {
    const store = makeStore()
    render(
      <ThemeProvider store={store}>
        <HookHarness />
      </ThemeProvider>,
    )
    expect(document.querySelector('[data-testid=name]')?.textContent).toBe(lightTheme.name)
    expect(document.querySelector('[data-testid=type]')?.textContent).toBe('light')
    expect(document.querySelector('[data-testid=count]')?.textContent).toBe('2')
  })

  it('setTheme updates the consumer', () => {
    const store = makeStore()
    render(
      <ThemeProvider store={store}>
        <HookHarness />
      </ThemeProvider>,
    )
    act(() => {
      fireEvent.click(document.querySelector('[data-testid=to-dark]')!)
    })
    expect(document.querySelector('[data-testid=name]')?.textContent).toBe(darkTheme.name)
    expect(document.querySelector('[data-testid=type]')?.textContent).toBe('dark')
  })

  it('applyTheme writes CSS variables on the documentElement', () => {
    const store = makeStore()
    render(
      <ThemeProvider store={store}>
        <HookHarness />
      </ThemeProvider>,
    )
    const root = document.documentElement
    expect(root.style.getPropertyValue('--iris-background')).toBeTruthy()
    expect(root.getAttribute('data-iris-theme')).toBe(lightTheme.name)
  })

  it('switching theme re-applies variables', () => {
    const store = makeStore()
    render(
      <ThemeProvider store={store}>
        <HookHarness />
      </ThemeProvider>,
    )
    const root = document.documentElement
    const lightBg = root.style.getPropertyValue('--iris-background')
    act(() => {
      fireEvent.click(document.querySelector('[data-testid=to-dark]')!)
    })
    const darkBg = root.style.getPropertyValue('--iris-background')
    expect(darkBg).not.toBe('')
    expect(darkBg).not.toBe(lightBg)
    expect(root.getAttribute('data-iris-theme')).toBe(darkTheme.name)
  })

  it('unmounting reverts the applied variables', () => {
    const store = makeStore()
    const { unmount } = render(
      <ThemeProvider store={store}>
        <HookHarness />
      </ThemeProvider>,
    )
    expect(document.documentElement.style.getPropertyValue('--iris-background')).toBeTruthy()
    unmount()
    expect(document.documentElement.style.getPropertyValue('--iris-background')).toBe('')
  })

  it('custom target receives the variables instead of documentElement', () => {
    const store = makeStore()
    const target = document.createElement('div')
    document.body.appendChild(target)
    render(
      <ThemeProvider store={store} target={target}>
        <HookHarness />
      </ThemeProvider>,
    )
    expect(target.style.getPropertyValue('--iris-background')).toBeTruthy()
    expect(document.documentElement.style.getPropertyValue('--iris-background')).toBe('')
    document.body.removeChild(target)
  })
})
