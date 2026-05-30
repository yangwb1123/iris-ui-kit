import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

afterEach(() => cleanup())

function Probe() {
  const reduced = usePrefersReducedMotion()
  return <div data-testid="p" data-reduced={String(reduced)} />
}

function mockMatchMedia(matches: boolean) {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
  }))
}

describe('@iris-ui/react usePrefersReducedMotion', () => {
  it('is false when matchMedia is unavailable', () => {
    const original = window.matchMedia
    // @ts-expect-error simulate environments without matchMedia
    delete window.matchMedia
    render(<Probe />)
    expect(screen.getByTestId('p').getAttribute('data-reduced')).toBe('false')
    window.matchMedia = original
  })

  it('is true when the user prefers reduced motion', () => {
    const original = window.matchMedia
    window.matchMedia = mockMatchMedia(true)
    render(<Probe />)
    expect(screen.getByTestId('p').getAttribute('data-reduced')).toBe('true')
    window.matchMedia = original
  })
})
