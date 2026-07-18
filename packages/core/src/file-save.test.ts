import { describe, it, expect, afterEach, vi } from 'vitest'
import { setFileSaveHandler, getFileSaveHandler, saveFile, type SaveFilePayload } from './file-save'

afterEach(() => setFileSaveHandler(null))

const payload: SaveFilePayload = {
  filename: 'data.csv',
  content: 'a,b\n1,2',
  mimeType: 'text/csv;charset=utf-8;',
}

describe('file-save handler registry', () => {
  it('saveFile returns false when no handler is registered', async () => {
    expect(getFileSaveHandler()).toBeNull()
    await expect(saveFile(payload)).resolves.toBe(false)
  })

  it('routes the payload to a registered handler and reports handled', async () => {
    const h = vi.fn()
    setFileSaveHandler(h)
    expect(getFileSaveHandler()).toBe(h)
    await expect(saveFile(payload)).resolves.toBe(true)
    expect(h).toHaveBeenCalledWith(payload)
  })

  it('treats a handler returning false as a decline (falls through)', async () => {
    setFileSaveHandler(() => false)
    await expect(saveFile(payload)).resolves.toBe(false)
  })

  it('treats a handler returning a truthy/undefined value as handled', async () => {
    setFileSaveHandler(() => undefined)
    await expect(saveFile(payload)).resolves.toBe(true)
    setFileSaveHandler(() => true)
    await expect(saveFile(payload)).resolves.toBe(true)
  })

  it('clears the handler with null', async () => {
    setFileSaveHandler(() => undefined)
    setFileSaveHandler(null)
    expect(getFileSaveHandler()).toBeNull()
    await expect(saveFile(payload)).resolves.toBe(false)
  })

  it('supports an async handler that returns false (decline)', async () => {
    setFileSaveHandler(async () => false)
    await expect(saveFile(payload)).resolves.toBe(false)
  })

  it('supports an async handler that returns true (handled)', async () => {
    setFileSaveHandler(async () => true)
    await expect(saveFile(payload)).resolves.toBe(true)
  })

  it('lets a throwing handler propagate (host owns its errors)', async () => {
    setFileSaveHandler(() => {
      throw new Error('native save failed')
    })
    await expect(saveFile(payload)).rejects.toThrow('native save failed')
  })

  it('lets an async rejecting handler propagate', async () => {
    setFileSaveHandler(async () => {
      throw new Error('async save failed')
    })
    await expect(saveFile(payload)).rejects.toThrow('async save failed')
  })
})
