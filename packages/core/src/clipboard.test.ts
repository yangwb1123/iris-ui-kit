import { describe, it, expect, afterEach, vi } from 'vitest'
import { setClipboardHandler, getClipboardHandler, copyText } from './clipboard'

afterEach(() => setClipboardHandler(null))

describe('clipboard handler registry', () => {
  it('copyText returns false when no handler is registered', () => {
    expect(getClipboardHandler()).toBeNull()
    expect(copyText('hi')).toBe(false)
  })

  it('routes the text to a registered handler and reports handled', () => {
    const h = vi.fn()
    setClipboardHandler(h)
    expect(getClipboardHandler()).toBe(h)
    expect(copyText('hello')).toBe(true)
    expect(h).toHaveBeenCalledWith('hello')
  })

  it('treats a handler returning false as a decline (falls through)', () => {
    setClipboardHandler(() => false)
    expect(copyText('x')).toBe(false)
  })

  it('treats undefined/truthy return as handled', () => {
    setClipboardHandler(() => undefined)
    expect(copyText('x')).toBe(true)
    setClipboardHandler(() => true)
    expect(copyText('x')).toBe(true)
  })

  it('clears the handler with null', () => {
    setClipboardHandler(() => undefined)
    setClipboardHandler(null)
    expect(getClipboardHandler()).toBeNull()
    expect(copyText('x')).toBe(false)
  })
})
