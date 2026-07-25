import { afterEach, describe, expect, it } from 'vitest'
import { applyDirection, getDirection } from './applyDirection'

afterEach(() => {
  document.documentElement.removeAttribute('dir')
  document.documentElement.removeAttribute('data-iris-dir')
})

describe('applyDirection', () => {
  it('sets dir and data-iris-dir on the target', () => {
    const el = document.createElement('div')
    applyDirection('rtl', el)
    expect(el.getAttribute('dir')).toBe('rtl')
    expect(el.getAttribute('data-iris-dir')).toBe('rtl')
  })

  it('defaults to documentElement', () => {
    applyDirection('rtl')
    expect(document.documentElement.getAttribute('dir')).toBe('rtl')
  })

  it('revert() restores prior attributes', () => {
    const el = document.createElement('div')
    el.setAttribute('dir', 'ltr')
    const applied = applyDirection('rtl', el)
    expect(el.getAttribute('dir')).toBe('rtl')
    applied.revert()
    expect(el.getAttribute('dir')).toBe('ltr')
    expect(el.getAttribute('data-iris-dir')).toBeNull()
  })
})

describe('getDirection', () => {
  it('defaults to ltr', () => {
    expect(getDirection(document.createElement('div'))).toBe('ltr')
  })

  it('reads data-iris-dir', () => {
    const el = document.createElement('div')
    el.setAttribute('data-iris-dir', 'rtl')
    expect(getDirection(el)).toBe('rtl')
  })

  it('falls back to the dir attribute', () => {
    const el = document.createElement('div')
    el.setAttribute('dir', 'rtl')
    expect(getDirection(el)).toBe('rtl')
  })

  it('revert with no prior dir restores to no attribute', () => {
    const el = document.createElement('div')
    const applied = applyDirection('rtl', el)
    applied.revert()
    expect(el.hasAttribute('dir')).toBe(false)
  })

  it('double revert is safe', () => {
    const el = document.createElement('div')
    const applied = applyDirection('rtl', el)
    applied.revert()
    applied.revert()
    expect(el.getAttribute('dir')).toBeNull()
  })

  it('revert restores data-iris-dir correctly', () => {
    const el = document.createElement('div')
    applyDirection('rtl', el)
    expect(el.getAttribute('data-iris-dir')).toBe('rtl')
    applyDirection('ltr', el)
    expect(el.getAttribute('data-iris-dir')).toBe('ltr')
  })

  it('handles auto direction', () => {
    const el = document.createElement('div')
    applyDirection('auto', el)
    expect(el.getAttribute('dir')).toBe('auto')
  })
})
