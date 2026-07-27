import { describe, it, expect } from 'vitest'
import { createSkinRegistry } from './registry'
import { builtinSkins } from './builtins'
import { applySkin } from './applySkin'

describe('applySkin', () => {
  const reg = createSkinRegistry(builtinSkins)

  it('writes core + custom vars and data-attrs, reverts cleanly', () => {
    reg.register({ id: 'c', extends: 'dark', custom: { 'brand.x': 3 } })
    const el = document.createElement('div')
    const applied = applySkin(reg.resolve('c'), el)
    expect(el.style.getPropertyValue('--iris-background')).not.toBe('')
    expect(el.style.getPropertyValue('--iris-shadow-sm')).not.toBe('')
    expect(el.style.getPropertyValue('--iris-z-toast')).not.toBe('')
    expect(el.style.getPropertyValue('--iris-transition-fast')).not.toBe('')
    expect(el.style.getPropertyValue('--brand-x')).toBe('3px')
    expect(el.getAttribute('data-iris-skin')).toBe('c')
    expect(el.getAttribute('data-iris-skin-type')).toBe('dark')
    applied.revert()
    expect(el.style.getPropertyValue('--brand-x')).toBe('')
    expect(el.getAttribute('data-iris-skin')).toBeNull()
  })
})
