import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  setFileSaveHandler,
  getFileSaveHandler,
  saveFile,
  downloadFile,
  type SaveFilePayload,
} from './file-save'

afterEach(() => {
  setFileSaveHandler(null)
  vi.unstubAllGlobals()
})

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

describe('downloadFile', () => {
  it('is SSR-safe and reports an unhandled download without a host', async () => {
    await expect(downloadFile(payload)).resolves.toBe(false)
  })

  it('uses the host handler without requiring browser globals', async () => {
    const host = vi.fn()
    setFileSaveHandler(host)
    await expect(downloadFile(payload)).resolves.toBe(true)
    expect(host).toHaveBeenCalledWith(payload)
  })

  it('creates and cleans up an anchor for the browser fallback', async () => {
    const anchor = {
      href: '',
      download: '',
      style: { display: '' },
      click: vi.fn(),
      remove: vi.fn(),
    }
    const appendChild = vi.fn()
    const createObjectURL = vi.fn(() => 'blob:iris')
    const revokeObjectURL = vi.fn()
    class TestBlob {
      constructor(
        readonly parts: string[],
        readonly options: { type: string },
      ) {}
    }

    vi.stubGlobal('document', {
      body: { appendChild },
      createElement: vi.fn(() => anchor),
    })
    vi.stubGlobal('Blob', TestBlob)
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    await expect(downloadFile(payload)).resolves.toBe(true)
    expect(createObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({ parts: [payload.content], options: { type: payload.mimeType } }),
    )
    expect(appendChild).toHaveBeenCalledWith(anchor)
    expect(anchor).toMatchObject({
      href: 'blob:iris',
      download: payload.filename,
      style: { display: 'none' },
    })
    expect(anchor.click).toHaveBeenCalledOnce()
    expect(anchor.remove).toHaveBeenCalledOnce()

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:iris')
  })
})
