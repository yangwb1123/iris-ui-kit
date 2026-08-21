import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

type Row = { id: number; name: string; age: number }
const columns: IrisTableColumn<Row>[] = [
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
  it('previews five rows and confirms all imported rows', () => {
    const onImport = vi.fn()
    const { container } = render(() => (
      <IrisTable columns={columns} data={[]} toolbar={{ onImport }} importPreview />
    ))
    selectCsv(container)
    expect(document.querySelectorAll('[data-iris-import-preview-table] tbody tr')).toHaveLength(5)
    expect(document.querySelector('[data-iris-import-preview-total]')?.textContent).toContain('6')
    fireEvent.click(document.querySelector('[data-iris-import-preview-confirm]')!)
    expect(onImport).toHaveBeenCalledTimes(1)
    expect(onImport.mock.calls[0]?.[0]).toHaveLength(6)
    expect(document.querySelector('[data-iris-import-preview]')).toBeNull()
  })

  it('cancel and Escape close without importing; header-only is a no-op', () => {
    const onImport = vi.fn()
    const { container } = render(() => (
      <IrisTable columns={columns} data={[]} toolbar={{ onImport }} importPreview />
    ))
    selectCsv(container, 'id,name,age')
    expect(document.querySelector('[data-iris-import-preview]')).toBeNull()
    selectCsv(container)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onImport).not.toHaveBeenCalled()
    expect(document.querySelector('[data-iris-import-preview]')).toBeNull()
  })

  it('keeps direct import when preview is disabled', () => {
    const onImport = vi.fn()
    const { container } = render(() => (
      <IrisTable columns={columns} data={[]} toolbar={{ onImport }} />
    ))
    selectCsv(container, 'id,name,age\n1,Ada,20')
    expect(onImport).toHaveBeenCalledWith([{ id: '1', name: 'Ada', age: '20' }])
    expect(document.querySelector('[data-iris-import-preview]')).toBeNull()
  })
})
