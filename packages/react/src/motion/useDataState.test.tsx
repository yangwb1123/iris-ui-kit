import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { useDataState } from './useDataState'
import { __resetDataStateStyles, __DATA_STATE_STYLE_ID } from './styles'
import type { DataStateInput } from '@iris-ui/core'

afterEach(() => {
  cleanup()
  __resetDataStateStyles()
})

function Probe(input: DataStateInput) {
  const r = useDataState(input)
  return (
    <div
      data-testid="probe"
      data-state={r.state}
      data-content={String(r.isContent)}
      {...r.stateProps}
    />
  )
}

describe('@iris-ui/react useDataState', () => {
  it('resolves "content" with no flags', () => {
    render(<Probe />)
    const el = screen.getByTestId('probe')
    expect(el.getAttribute('data-state')).toBe('content')
    expect(el.getAttribute('data-content')).toBe('true')
  })

  it('follows error → loading → empty precedence', () => {
    const { rerender } = render(<Probe empty />)
    expect(screen.getByTestId('probe').getAttribute('data-iris-state')).toBe('empty')
    rerender(<Probe loading empty />)
    expect(screen.getByTestId('probe').getAttribute('data-iris-state')).toBe('loading')
    rerender(<Probe error loading empty />)
    expect(screen.getByTestId('probe').getAttribute('data-iris-state')).toBe('error')
  })

  it('applies the enter-animation class and injects the stylesheet', () => {
    render(<Probe loading />)
    expect(screen.getByTestId('probe').className).toContain('iris-data-state-enter')
    expect(document.getElementById(__DATA_STATE_STYLE_ID)).not.toBeNull()
  })

  it('drops the animation class under prefers-reduced-motion', () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: () => false,
    }))
    render(<Probe loading />)
    expect(screen.getByTestId('probe').className).toBe('')
    window.matchMedia = original
  })
})
