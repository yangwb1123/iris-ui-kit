import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createThemeStore } from '@iris-ui-kit/theme'
import { darkTheme, lightTheme } from '@iris-ui-kit/tokens'
import { ThemeProvider, useDirection } from './ThemeProvider'

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('dir')
  document.documentElement.removeAttribute('data-iris-dir')
})

function makeStore() {
  return createThemeStore({ themes: { light: lightTheme, dark: darkTheme }, default: 'light' })
}

function DirProbe() {
  return <span data-testid="dir">{useDirection()}</span>
}

describe('@iris-ui-kit/react ThemeProvider dir / useDirection', () => {
  it('defaults to ltr without an explicit dir', () => {
    const target = document.createElement('div')
    render(
      <ThemeProvider store={makeStore()} target={target}>
        <DirProbe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('dir').textContent).toBe('ltr')
  })

  it('applies dir="rtl" to the target and exposes it via useDirection', () => {
    const target = document.createElement('div')
    render(
      <ThemeProvider store={makeStore()} target={target} dir="rtl">
        <DirProbe />
      </ThemeProvider>,
    )
    expect(target.getAttribute('dir')).toBe('rtl')
    expect(target.getAttribute('data-iris-dir')).toBe('rtl')
    expect(screen.getByTestId('dir').textContent).toBe('rtl')
  })

  it('useDirection returns ltr with no provider', () => {
    render(<DirProbe />)
    expect(screen.getByTestId('dir').textContent).toBe('ltr')
  })
})
