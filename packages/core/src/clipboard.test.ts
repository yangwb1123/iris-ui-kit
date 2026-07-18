import { describe, it, expect, afterEach, vi } from 'vitest'
import { setClipboardHandler, getClipboardHandler, copyText } from './clipboard'

afterEach(() => setClipboardHandler(null))

describe('clipboard handler registry', () => {
  it('copyText returns false when no handler is registered', async () => {
    expect(getClipboardHandler()).toBeNull()
    await expect(copyText('hi')).resolves.toBe(false)
  })

  it('routes the text to a registered handler and reports handled', async () => {
    const h = vi.fn()
    setClipboardHandler(h)
    expect(getClipboardHandler()).toBe(h)
    await expect(copyText('hello')).resolves.toBe(true)
    expect(h).toHaveBeenCalledWith('hello')
  })

  it('treats a handler returning false as a decline (falls through)', async () => {
    setClipboardHandler(() => false)
    await expect(copyText('x')).resolves.toBe(false)
  })

  it('treats undefined/truthy return as handled', async () => {
    setClipboardHandler(() => undefined)
    await expect(copyText('x')).resolves.toBe(true)
    setClipboardHandler(() => true)
    await expect(copyText('x')).resolves.toBe(true)
  })

  it('supports an async handler that returns false', async () => {
    setClipboardHandler(async () => false)
    await expect(copyText('x')).resolves.toBe(false)
  })

  it('supports an async handler that returns true', async () => {
    setClipboardHandler(async () => true)
    await expect(copyText('x')).resolves.toBe(true)
  })

  it('clears the handler with null', async () => {
    setClipboardHandler(() => undefined)
    setClipboardHandler(null)
    expect(getClipboardHandler()).toBeNull()
    await expect(copyText('x')).resolves.toBe(false)
  })
})
