import { describe, it, expect } from 'vitest'

// Test the pure logic of async module — no component rendering needed.
describe('useAsyncResource module', () => {
  it('exports useAsyncResource function', async () => {
    // Dynamic import to avoid Svelte module context issues in unit tests
    const mod = await import('./useAsyncResource')
    expect(typeof mod.useAsyncResource).toBe('function')
  })
})

describe('usePaginatedResource module', () => {
  it('exports usePaginatedResource function', async () => {
    const mod = await import('./usePaginatedResource')
    expect(typeof mod.usePaginatedResource).toBe('function')
  })
})
