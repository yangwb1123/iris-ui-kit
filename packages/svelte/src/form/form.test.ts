import { describe, it, expect } from 'vitest'

describe('form module', () => {
  it('exports IrisForm, useForm, useField', async () => {
    const mod = await import('./index')
    expect(typeof mod.IrisForm).toBe('function')
    expect(typeof mod.useForm).toBe('function')
    expect(typeof mod.useField).toBe('function')
  })
})
