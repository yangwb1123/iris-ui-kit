import { describe, it, expect } from 'vitest'

describe('motion module', () => {
  it('exports useDataState and usePrefersReducedMotion', async () => {
    const mod = await import('./index')
    expect(typeof mod.useDataState).toBe('function')
    expect(typeof mod.usePrefersReducedMotion).toBe('function')
  })
})
