import { describe, it, expect } from 'vitest'
import { renderHook } from '@solidjs/testing-library'
import { useDataState } from './useDataState'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

describe('useDataState', () => {
  it('returns content state when not loading/error/empty', () => {
    const { result } = renderHook(() =>
      useDataState(() => ({ loading: false, error: undefined, empty: false })),
    )
    expect(result.state()).toBe('content')
    expect(result.isContent()).toBe(true)
  })

  it('returns loading state when loading=true', () => {
    const { result } = renderHook(() =>
      useDataState(() => ({ loading: true, error: undefined, empty: false })),
    )
    expect(result.state()).toBe('loading')
    expect(result.isContent()).toBe(false)
  })

  it('returns error state when error is set', () => {
    const { result } = renderHook(() =>
      useDataState(() => ({ loading: false, error: true, empty: false })),
    )
    expect(result.state()).toBe('error')
  })
})

describe('usePrefersReducedMotion', () => {
  it('returns a boolean signal', () => {
    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(typeof result()).toBe('boolean')
  })
})
