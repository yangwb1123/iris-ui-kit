import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'
import { ThemeProvider, useTheme } from './index'

afterEach(cleanup)

describe('@iris-ui-kit/solid theme', () => {
  it('provides the active theme, applies CSS vars, and switches via setTheme', () => {
    const store = createThemeStore({
      themes: { light: lightTheme, dark: darkTheme },
      default: 'light',
    })
    let api!: ReturnType<typeof useTheme>
    const Probe = () => {
      api = useTheme()
      return <div data-name="">{api.theme().name}</div>
    }
    const { container } = render(() => (
      <ThemeProvider store={store}>
        <Probe />
      </ThemeProvider>
    ))

    expect(container.querySelector('[data-name]')!.textContent).toBe(lightTheme.name)
    // applied to document.documentElement (default target)
    expect(document.documentElement.style.getPropertyValue('--iris-background')).toBeTruthy()

    api.setTheme('dark')
    expect(container.querySelector('[data-name]')!.textContent).toBe(darkTheme.name)
  })
})
