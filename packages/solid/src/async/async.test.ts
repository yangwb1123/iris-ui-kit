import { describe, it, expect, vi } from 'vitest'
import { useAsyncResource } from './useAsyncResource'
import { renderHook } from '@solidjs/testing-library'

describe('useAsyncResource', () => {
  it('initializes with idle status', () => {
    const fetcher = vi.fn().mockResolvedValue(['data'])
    const { result } = renderHook(() => useAsyncResource(fetcher))
    expect(result.status()).toBe('idle')
    expect(result.data()).toBeUndefined()
    expect(result.isLoading()).toBe(false)
    expect(result.isError()).toBe(false)
  })

  it('has load, reload, mutate, cancel, reset methods', () => {
    const fetcher = vi.fn().mockResolvedValue(['data'])
    const { result } = renderHook(() => useAsyncResource(fetcher))
    expect(typeof result.load).toBe('function')
    expect(typeof result.reload).toBe('function')
    expect(typeof result.mutate).toBe('function')
    expect(typeof result.cancel).toBe('function')
    expect(typeof result.reset).toBe('function')
  })
})
