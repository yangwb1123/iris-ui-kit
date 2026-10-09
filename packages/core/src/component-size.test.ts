import { describe, expect, it } from 'vitest'
import { DEFAULT_COMPONENT_SIZE, resolveComponentSize } from './component-size'
import type { Size } from './types'

describe('component size precedence', () => {
  it.each(['sm', 'md', 'lg'] as Size[])('preserves explicit %s over every parent', (size) => {
    for (const parent of ['sm', 'md', 'lg', null, undefined] as const) {
      expect(resolveComponentSize(size, parent)).toBe(size)
    }
  })
  it.each(['sm', 'md', 'lg'] as Size[])('inherits %s only when omitted', (size) => {
    expect(resolveComponentSize(undefined, size)).toBe(size)
  })
  it('uses md only when both sources are absent', () => {
    expect(DEFAULT_COMPONENT_SIZE).toBe('md')
    expect(resolveComponentSize(undefined, null)).toBe('md')
    expect(resolveComponentSize(undefined, undefined)).toBe('md')
  })
})
