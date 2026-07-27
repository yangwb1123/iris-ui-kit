import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { useColorScheme } from './useColorScheme'

afterEach(() => {
  cleanup()
  delete (window as unknown as { matchMedia?: unknown }).matchMedia
})

type Handler = (event: { matches: boolean }) => void

function mockMatchMedia(initialDark: boolean) {
  const listeners = new Set<Handler>()
  const mql = {
    matches: initialDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_t: string, cb: Handler) => listeners.add(cb),
    removeEventListener: (_t: string, cb: Handler) => listeners.delete(cb),
    addListener: (cb: Handler) => listeners.add(cb),
    removeListener: (cb: Handler) => listeners.delete(cb),
  }
  ;(window as unknown as { matchMedia: unknown }).matchMedia = vi.fn(() => mql)
  return {
    set(dark: boolean) {
      mql.matches = dark
      listeners.forEach((cb) => cb({ matches: dark }))
    },
  }
}

function Probe() {
  const scheme = useColorScheme()
  return <span data-testid="scheme">{scheme}</span>
}

describe('@iris-ui-kit/react useColorScheme', () => {
  it('reports the initial system scheme', () => {
    mockMatchMedia(true)
    render(<Probe />)
    expect(screen.getByTestId('scheme').textContent).toBe('dark')
  })

  it('updates when the system preference flips', () => {
    const m = mockMatchMedia(false)
    render(<Probe />)
    expect(screen.getByTestId('scheme').textContent).toBe('light')
    act(() => m.set(true))
    expect(screen.getByTestId('scheme').textContent).toBe('dark')
  })

  it('falls back to "light" without matchMedia', () => {
    render(<Probe />)
    expect(screen.getByTestId('scheme').textContent).toBe('light')
  })
})
