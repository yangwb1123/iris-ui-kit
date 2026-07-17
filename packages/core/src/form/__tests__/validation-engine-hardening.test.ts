import { describe, expect, it } from 'vitest'
import { createValidationEngine } from '../../form'

describe('createValidationEngine — validateField exception safety', () => {
  it('a synchronously-throwing validator does not leave onValidating stuck true', async () => {
    const states: boolean[] = []
    const engine = createValidationEngine(
      {
        x: () => {
          throw new Error('Boom')
        },
      },
      true,
      0,
      { onValidating: (_name, on) => states.push(on), onError: () => {} },
      () => ({ x: '' }),
    )
    const error = await engine.validateField('x', { x: '' })
    expect(error).toBe('Boom')
    // true (validation started) then false (cleared) — never stuck at true.
    expect(states).toEqual([true, false])
  })

  it('a rejecting async validator does not leave onValidating stuck true', async () => {
    const states: boolean[] = []
    const engine = createValidationEngine(
      {
        x: async () => {
          throw new Error('Async boom')
        },
      },
      true,
      0,
      { onValidating: (_name, on) => states.push(on), onError: () => {} },
      () => ({ x: '' }),
    )
    const error = await engine.validateField('x', { x: '' })
    expect(error).toBe('Async boom')
    expect(states).toEqual([true, false])
  })

  it('validateForm still silently drops a throwing validator (unchanged contract)', async () => {
    const engine = createValidationEngine(
      {
        x: () => {
          throw new Error('Boom')
        },
      },
      true,
      0,
      { onValidating: () => {}, onError: () => {} },
      () => ({ x: '' }),
    )
    const errors = await engine.validateForm({ x: () => undefined }, { x: '' })
    expect(errors).toEqual({})
  })
})
