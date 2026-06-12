import { describe, it, expect, afterEach, vi } from 'vitest'
import { setFileSaveHandler, getFileSaveHandler, saveFile, type SaveFilePayload } from './file-save'

afterEach(() => setFileSaveHandler(null))

const payload: SaveFilePayload = {
  filename: 'data.csv',
  content: 'a,b\n1,2',
  mimeType: 'text/csv;charset=utf-8;',
}

describe('file-save handler registry', () => {
  it('saveFile returns false when no handler is registered', () => {
    expect(getFileSaveHandler()).toBeNull()
    expect(saveFile(payload)).toBe(false)
  })

  it('routes the payload to a registered handler and reports handled', () => {
    const h = vi.fn()
    setFileSaveHandler(h)
    expect(getFileSaveHandler()).toBe(h)
    expect(saveFile(payload)).toBe(true)
    expect(h).toHaveBeenCalledWith(payload)
  })

  it('treats a handler returning false as a decline (falls through)', () => {
    setFileSaveHandler(() => false)
    expect(saveFile(payload)).toBe(false)
  })

  it('treats a handler returning a truthy/undefined value as handled', () => {
    setFileSaveHandler(() => undefined)
    expect(saveFile(payload)).toBe(true)
    setFileSaveHandler(() => true)
    expect(saveFile(payload)).toBe(true)
  })

  it('clears the handler with null', () => {
    setFileSaveHandler(() => undefined)
    setFileSaveHandler(null)
    expect(getFileSaveHandler()).toBeNull()
    expect(saveFile(payload)).toBe(false)
  })

  it('lets a throwing handler propagate (host owns its errors)', () => {
    setFileSaveHandler(() => {
      throw new Error('native save failed')
    })
    expect(() => saveFile(payload)).toThrow('native save failed')
  })
})
