import { describe, it, expect } from 'vitest'
import { createSkinRegistry } from './registry'
import { builtinSkins } from './builtins'

describe('createSkinRegistry', () => {
  it('registers builtin light/dark and resolves them complete', () => {
    const reg = createSkinRegistry(builtinSkins)
    expect(reg.has('light')).toBe(true)
    expect(reg.has('dark')).toBe(true)
    const dark = reg.resolve('dark')
    expect(dark.type).toBe('dark')
    // 键数与 tokens 包定义同步（刻度扩展：font 家族 + on.color/warning.foreground）
    expect(Object.keys(dark.theme.colors).length).toBeGreaterThanOrEqual(40)
    expect(Object.keys(dark.theme.colors)).toContain('iris.font.size.4xl')
    expect(Object.keys(dark.theme.colors)).toContain('iris.on.color')
  })

  it('resolves a partial skin that extends a builtin', () => {
    const reg = createSkinRegistry(builtinSkins)
    expect(
      reg.register({ id: 'brand', extends: 'dark', tokens: { 'iris.primary': '#ff0' } }),
    ).toEqual([])
    const r = reg.resolve('brand')
    expect(r.theme.colors['iris.primary']).toBe('#ff0')
    expect(r.lineage).toEqual(['dark', 'brand'])
  })

  it('does not register an invalid skin', () => {
    const reg = createSkinRegistry()
    const errs = reg.register({ id: '' })
    expect(errs.length).toBeGreaterThan(0)
    expect(reg.list().length).toBe(0)
  })
})
