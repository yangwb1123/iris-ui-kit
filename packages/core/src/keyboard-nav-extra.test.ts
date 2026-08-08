import { describe, it, expect } from 'vitest'
import { createKeyboardNav } from './keyboard-nav'
function key(key: string): { key: string; preventDefault: () => void } {
  return { key, preventDefault: () => {} }
}

describe('edge cases', () => {
  it('handles count=0', () => {
    const nav = createKeyboardNav({ count: 0 })
    expect(nav.index).toBe(-1)
    expect(nav.handleKeyDown(key('ArrowDown'))).toEqual({ type: 'noop' })
    expect(nav.handleKeyDown(key('Home'))).toEqual({ type: 'noop' })
    expect(nav.handleKeyDown(key('End'))).toEqual({ type: 'noop' })
    expect(nav.handleKeyDown(key('Enter'))).toEqual({ type: 'noop' })
    expect(nav.handleKeyDown(key('Escape'))).toEqual({ type: 'escape' })
  })

  it('handles count=1', () => {
    const nav = createKeyboardNav({ count: 1 })
    expect(nav.index).toBe(0)
    // No movement possible
    expect(nav.handleKeyDown(key('ArrowDown'))).toEqual({ type: 'noop' })
    expect(nav.handleKeyDown(key('ArrowUp'))).toEqual({ type: 'noop' })
    // Home/End are noop
    expect(nav.handleKeyDown(key('Home'))).toEqual({ type: 'noop' })
    expect(nav.handleKeyDown(key('End'))).toEqual({ type: 'noop' })
    // Select still works
    expect(nav.handleKeyDown(key('Enter'))).toEqual({ type: 'select', target: 0 })
  })
})
