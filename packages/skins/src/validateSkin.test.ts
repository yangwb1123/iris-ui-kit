import { describe, it, expect } from 'vitest'
import { validateSkin } from './validateSkin'
import type { Skin } from './types'

describe('validateSkin', () => {
  it('accepts a minimal valid skin', () => {
    expect(validateSkin({ id: 'ok' })).toEqual([])
  })

  it('rejects empty id', () => {
    const errs = validateSkin({ id: '' } as Skin)
    expect(errs.some((e) => e.code === 'validate')).toBe(true)
  })

  it('rejects an unknown core token key', () => {
    const errs = validateSkin({ id: 'x', tokens: { 'iris.primaryy': '#000' } as never })
    expect(errs.some((e) => e.keys?.includes('iris.primaryy'))).toBe(true)
  })

  it('rejects a non-string color token value', () => {
    const errs = validateSkin({ id: 'x', tokens: { 'iris.primary': 5 as never } })
    expect(errs.some((e) => e.keys?.includes('iris.primary'))).toBe(true)
  })

  it('rejects a non-number spacing token value', () => {
    const errs = validateSkin({ id: 'x', tokens: { 'iris.gap.md': '8' as never } })
    expect(errs.some((e) => e.keys?.includes('iris.gap.md'))).toBe(true)
  })

  it('accepts custom tokens with string or number values', () => {
    expect(
      validateSkin({ id: 'x', custom: { 'iris.shadow.card': '0 1px 2px #000', 'brand.z': 10 } }),
    ).toEqual([])
  })

  it('rejects an invalid custom token key', () => {
    const errs = validateSkin({ id: 'x', custom: { '': 'v' } })
    expect(errs.some((e) => e.code === 'validate')).toBe(true)
  })

  it('rejects non-string extends entries', () => {
    const errs = validateSkin({ id: 'x', extends: [5 as never] })
    expect(errs.some((e) => e.code === 'validate')).toBe(true)
  })
})
