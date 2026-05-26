import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisFileUpload, formatBytes } from './FileUpload'

afterEach(() => cleanup())

function fileOf(name: string, size: number, type = 'text/plain'): File {
  return new File([new Blob([new ArrayBuffer(size)], { type })], name, { type })
}

describe('@iris-ui/react formatBytes', () => {
  it('B/KB/MB/GB', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB')
  })
})

describe('@iris-ui/react IrisFileUpload', () => {
  it('renders zone + hidden input', () => {
    render(<IrisFileUpload />)
    expect(document.querySelector('[data-iris-file-upload-zone]')).not.toBeNull()
    expect(document.querySelector('[data-iris-file-upload-input]')).not.toBeNull()
  })

  it('multiple/accept props forward to native input', () => {
    render(<IrisFileUpload multiple accept="image/*" />)
    const input = document.querySelector('[data-iris-file-upload-input]') as HTMLInputElement
    expect(input.multiple).toBe(true)
    expect(input.accept).toBe('image/*')
  })

  it('selecting a file emits onValueChange', () => {
    const onChange = vi.fn()
    render(<IrisFileUpload onValueChange={onChange} />)
    const input = document.querySelector('[data-iris-file-upload-input]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [fileOf('a.txt', 100)], configurable: true })
    act(() => {
      fireEvent.change(input)
    })
    expect(onChange).toHaveBeenCalled()
    const next = onChange.mock.calls.at(-1)![0] as { name: string }[]
    expect(next[0]?.name).toBe('a.txt')
  })

  it('multiple=true appends to selection', () => {
    const existing = { file: fileOf('a.txt', 1), name: 'a.txt', size: 1, type: 'text/plain' }
    const onChange = vi.fn()
    render(<IrisFileUpload multiple value={[existing]} onValueChange={onChange} />)
    const input = document.querySelector('[data-iris-file-upload-input]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [fileOf('b.txt', 2)], configurable: true })
    act(() => {
      fireEvent.change(input)
    })
    const next = onChange.mock.calls.at(-1)![0] as { name: string }[]
    expect(next.map((f) => f.name)).toEqual(['a.txt', 'b.txt'])
  })

  it('maxSize rejects oversized files', () => {
    const onReject = vi.fn()
    const onChange = vi.fn()
    render(<IrisFileUpload maxSize={100} onReject={onReject} onValueChange={onChange} />)
    const input = document.querySelector('[data-iris-file-upload-input]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [fileOf('big.txt', 200)], configurable: true })
    act(() => {
      fireEvent.change(input)
    })
    expect(onReject).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)![0]).toEqual([])
  })

  it('accept filter rejects mismatched type', () => {
    const onReject = vi.fn()
    render(<IrisFileUpload accept="image/*" onReject={onReject} />)
    const input = document.querySelector('[data-iris-file-upload-input]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [fileOf('a.txt', 1, 'text/plain')], configurable: true })
    act(() => {
      fireEvent.change(input)
    })
    expect(onReject).toHaveBeenCalled()
    const entries = onReject.mock.calls.at(-1)![0] as { reason: string }[]
    expect(entries[0]?.reason).toBe('type')
  })

  it('drop event applies files', () => {
    const onChange = vi.fn()
    render(<IrisFileUpload onValueChange={onChange} />)
    const zone = document.querySelector('[data-iris-file-upload-zone]')!
    const dt = { files: [fileOf('drop.txt', 50)] }
    act(() => {
      fireEvent.drop(zone, { dataTransfer: dt })
    })
    expect(onChange).toHaveBeenCalled()
  })

  it('dragenter sets data-drag-over; dragleave reverts', () => {
    render(<IrisFileUpload />)
    const zone = document.querySelector('[data-iris-file-upload-zone]')!
    act(() => {
      fireEvent.dragEnter(zone)
    })
    expect(
      document.querySelector('[data-iris-file-upload]')?.getAttribute('data-drag-over'),
    ).toBe('true')
    act(() => {
      fireEvent.dragLeave(zone)
    })
    expect(
      document.querySelector('[data-iris-file-upload]')?.getAttribute('data-drag-over'),
    ).toBeNull()
  })

  it('renders file list when value has entries', () => {
    render(
      <IrisFileUpload
        value={[
          { file: fileOf('a.txt', 100), name: 'a.txt', size: 100, type: 'text/plain' },
          { file: fileOf('b.txt', 200), name: 'b.txt', size: 200, type: 'text/plain' },
        ]}
      />,
    )
    expect(document.querySelectorAll('[data-iris-file-upload-item]').length).toBe(2)
  })

  it('remove button drops the file', () => {
    const a = { file: fileOf('a.txt', 1), name: 'a.txt', size: 1, type: 'text/plain' }
    const b = { file: fileOf('b.txt', 2), name: 'b.txt', size: 2, type: 'text/plain' }
    const onChange = vi.fn()
    render(<IrisFileUpload value={[a, b]} onValueChange={onChange} />)
    const removeBtns = document.querySelectorAll('button[aria-label^="Remove"]')
    act(() => {
      fireEvent.click(removeBtns[0]!)
    })
    expect(onChange.mock.calls.at(-1)![0]).toEqual([b])
  })

  it('disabled blocks drop', () => {
    const onChange = vi.fn()
    render(<IrisFileUpload disabled onValueChange={onChange} />)
    const zone = document.querySelector('[data-iris-file-upload-zone]')!
    act(() => {
      fireEvent.drop(zone, { dataTransfer: { files: [fileOf('x', 1)] } })
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('id forwards to hidden input', () => {
    render(<IrisFileUpload id="my-upload" />)
    expect((document.querySelector('[data-iris-file-upload-input]') as HTMLInputElement).id).toBe(
      'my-upload',
    )
  })
})
