import { describe, it, expect } from 'vitest'
import { applyCssVars } from './applyCssVars'

describe('applyCssVars', () => {
  it('writes entries as inline custom properties', () => {
    const el = document.createElement('div')
    applyCssVars(
      [
        ['--iris-background', '#fff'],
        ['--iris-gap-md', '8px'],
      ],
      el,
    )
    expect(el.style.getPropertyValue('--iris-background')).toBe('#fff')
    expect(el.style.getPropertyValue('--iris-gap-md')).toBe('8px')
  })

  it('revert() restores prior values and removes previously-unset ones', () => {
    const el = document.createElement('div')
    el.style.setProperty('--iris-background', '#000')
    const applied = applyCssVars(
      [
        ['--iris-background', '#fff'],
        ['--iris-accent', 'red'],
      ],
      el,
    )
    applied.revert()
    expect(el.style.getPropertyValue('--iris-background')).toBe('#000')
    expect(el.style.getPropertyValue('--iris-accent')).toBe('')
  })
})
