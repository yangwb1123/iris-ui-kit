import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const columns = [
  { key: 'id', title: 'ID' },
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]
const csv = 'id,name,age\n1,Alice,25\n2,Bob,30\n3,Carol,35\n4,Dan,40\n5,Eve,45\n6,Frank,50'

function stubReader(text: string): void {
  class FakeFileReader {
    result: string | null = null
    onload: (() => void) | null = null
    readAsText(): void {
      this.result = text
      this.onload?.()
    }
  }
  vi.stubGlobal('FileReader', FakeFileReader as unknown as typeof FileReader)
}

function selectCsv(container: HTMLElement, text = csv): void {
  stubReader(text)
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, {
    target: { files: [new File([text], 'rows.csv', { type: 'text/csv' })] },
  })
}

describe('IrisTable importPreview', () => {
  it('previews five rows and confirms all imported rows', async () => {
    const onImport = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns, data: [], toolbar: { onImport }, importPreview: true },
    })
    selectCsv(container)
    await waitFor(() =>
      expect(document.querySelectorAll('[data-iris-import-preview-table] tbody tr')).toHaveLength(
        5,
      ),
    )
    expect(document.querySelector('[data-iris-import-preview-total]')?.textContent).toContain('6')
    fireEvent.click(document.querySelector('[data-iris-import-preview-confirm]')!)
    expect(onImport).toHaveBeenCalledTimes(1)
    expect(onImport.mock.calls[0]?.[0]).toHaveLength(6)
    expect(document.querySelector('[data-iris-import-preview]')).toBeNull()
  })

  it('cancel and Escape close without importing; header-only is a no-op', async () => {
    const onImport = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns, data: [], toolbar: { onImport }, importPreview: true },
    })
    selectCsv(container, 'id,name,age')
    expect(document.querySelector('[data-iris-import-preview]')).toBeNull()
    selectCsv(container)
    await waitFor(() => expect(document.querySelector('[data-iris-import-preview]')).not.toBeNull())
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await waitFor(() => expect(document.querySelector('[data-iris-import-preview]')).toBeNull())
    expect(onImport).not.toHaveBeenCalled()
  })

  it('keeps direct import when preview is disabled', () => {
    const onImport = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns, data: [], toolbar: { onImport } },
    })
    selectCsv(container, 'id,name,age\n1,Ada,20')
    expect(onImport).toHaveBeenCalledWith([{ id: '1', name: 'Ada', age: '20' }])
    expect(document.querySelector('[data-iris-import-preview]')).toBeNull()
  })
})
