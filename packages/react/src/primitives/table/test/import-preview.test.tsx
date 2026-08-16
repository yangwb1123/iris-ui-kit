import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisI18nProvider } from '../../../i18n'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

interface Row extends Record<string, unknown> {
  id: number
}

const columns: IrisTableColumn<Row>[] = [
  { key: 'id', title: 'ID' },
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

/** Synchronous FileReader fake: `readAsText` runs `onload` immediately with
 * the LATEST `importCsv` text, so `fireEvent.change` leaves the preview state
 * settled and a re-import carries the new file's content. */
let fileText = ''
const stubFileReader = (text: string): void => {
  fileText = text
  class FakeFileReader {
    result: string | null = null
    onload: (() => void) | null = null
    readAsText(): void {
      this.result = fileText
      this.onload?.()
    }
  }
  vi.stubGlobal('FileReader', FakeFileReader as unknown as typeof FileReader)
}

const importCsv = (container: HTMLElement, text: string): void => {
  stubFileReader(text)
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File([text], 'rows.csv', { type: 'text/csv' })
  fireEvent.change(input, { target: { files: [file] } })
}

const SEVEN_ROWS =
  'id,name,age\n1,Alice,25\n2,Bob,30\n3,Carol,35\n4,Dan,40\n5,Eve,45\n6,Frank,50\n7,Grace,55'

const previewModal = (): HTMLElement | null => document.querySelector('[data-iris-import-preview]')

const previewBodyRows = (): NodeListOf<HTMLElement> =>
  document.querySelectorAll('[data-iris-import-preview-table] tbody tr')

const totalNote = (): HTMLElement | null =>
  document.querySelector('[data-iris-import-preview-total]')

describe('IrisTable importPreview (iris 独有, batch CW)', () => {
  it('preview shows exactly the first 5 of 7 rows with a total note (spec ①)', () => {
    const onImport = vi.fn()
    const { container } = render(
      <IrisTable columns={columns} data={[]} rowKey="id" toolbar={{ onImport }} importPreview />,
    )
    importCsv(container, SEVEN_ROWS)
    const rows = previewBodyRows()
    expect(rows).toHaveLength(5)
    expect(rows[0]?.textContent).toBe('1Alice25')
    expect(rows[4]?.textContent).toBe('5Eve45')
    // Row 6 is NOT in the preview (truncation).
    expect(document.body.textContent).not.toContain('6Frank50')
    // Headers come from the CSV in order.
    const headers = Array.from(document.querySelectorAll('[data-iris-import-preview-header]')).map(
      (el) => el.textContent,
    )
    expect(headers).toEqual(['id', 'name', 'age'])
    expect(totalNote()?.textContent).toBe('Total 7')
    expect(onImport).not.toHaveBeenCalled()
  })

  it('confirm calls onImport ONCE with ALL rows, then closes (spec ②)', () => {
    const onImport = vi.fn()
    const { container } = render(
      <IrisTable columns={columns} data={[]} rowKey="id" toolbar={{ onImport }} importPreview />,
    )
    importCsv(container, SEVEN_ROWS)
    fireEvent.click(document.querySelector('[data-iris-import-preview-confirm]')!)
    expect(onImport).toHaveBeenCalledTimes(1)
    const payload = onImport.mock.calls[0]![0] as Record<string, string>[]
    expect(payload).toHaveLength(7)
    expect(payload[0]).toEqual({ id: '1', name: 'Alice', age: '25' })
    expect(payload[6]).toEqual({ id: '7', name: 'Grace', age: '55' })
    // No partial commit and the modal is gone.
    expect(previewModal()).toBeNull()
  })

  it('cancel closes with ZERO onImport calls (spec ③)', () => {
    const onImport = vi.fn()
    const { container } = render(
      <IrisTable columns={columns} data={[]} rowKey="id" toolbar={{ onImport }} importPreview />,
    )
    importCsv(container, SEVEN_ROWS)
    fireEvent.click(document.querySelector('[data-iris-import-preview-cancel]')!)
    expect(onImport).not.toHaveBeenCalled()
    expect(previewModal()).toBeNull()
  })

  it('importPreview off keeps the direct import path byte-identical (no modal nodes)', () => {
    const onImport = vi.fn()
    const { container } = render(
      <IrisTable columns={columns} data={[]} rowKey="id" toolbar={{ onImport }} />,
    )
    importCsv(container, SEVEN_ROWS)
    expect(onImport).toHaveBeenCalledTimes(1)
    expect((onImport.mock.calls[0]![0] as unknown[]).length).toBe(7)
    expect(document.querySelector('[data-iris-import-preview]')).toBeNull()
    expect(document.querySelector('[data-iris-import-preview-backdrop]')).toBeNull()
  })

  it('Esc closes the preview without importing (listener only while open)', () => {
    const onImport = vi.fn()
    const { container } = render(
      <IrisTable columns={columns} data={[]} rowKey="id" toolbar={{ onImport }} importPreview />,
    )
    importCsv(container, SEVEN_ROWS)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(previewModal()).toBeNull()
    expect(onImport).not.toHaveBeenCalled()
  })

  it('backdrop pointerdown closes without importing', () => {
    const onImport = vi.fn()
    const { container } = render(
      <IrisTable columns={columns} data={[]} rowKey="id" toolbar={{ onImport }} importPreview />,
    )
    importCsv(container, SEVEN_ROWS)
    const backdrop = document.querySelector('[data-iris-import-preview-backdrop]') as HTMLElement
    const PointerCtor = (globalThis as Record<string, unknown>).PointerEvent
    act(() => {
      if (typeof PointerCtor === 'function') {
        backdrop.dispatchEvent(
          new (PointerCtor as new (t: string, i?: EventInit) => Event)('pointerdown', {
            bubbles: true,
          }),
        )
      } else {
        const ev = new Event('pointerdown', { bubbles: true })
        backdrop.dispatchEvent(ev)
      }
    })
    expect(previewModal()).toBeNull()
    expect(onImport).not.toHaveBeenCalled()
  })

  it('single-line CSV stays a silent no-op (header-only preserved)', () => {
    const onImport = vi.fn()
    const { container } = render(
      <IrisTable columns={columns} data={[]} rowKey="id" toolbar={{ onImport }} importPreview />,
    )
    importCsv(container, 'id,name,age')
    expect(previewModal()).toBeNull()
    expect(onImport).not.toHaveBeenCalled()
  })

  it('blank second line renders one empty-string row; confirm imports it raw', () => {
    const onImport = vi.fn()
    const { container } = render(
      <IrisTable columns={columns} data={[]} rowKey="id" toolbar={{ onImport }} importPreview />,
    )
    importCsv(container, 'id,name,age\n\n')
    expect(previewBodyRows()).toHaveLength(1)
    expect(previewBodyRows()[0]?.textContent).toBe('')
    fireEvent.click(document.querySelector('[data-iris-import-preview-confirm]')!)
    expect(onImport).toHaveBeenCalledTimes(1)
    expect(onImport.mock.calls[0]![0]).toEqual([{ id: '', name: '', age: '' }])
  })

  it('total note appears only when more than 5 rows (boundary)', () => {
    const onImport = vi.fn()
    const { container } = render(
      <IrisTable columns={columns} data={[]} rowKey="id" toolbar={{ onImport }} importPreview />,
    )
    importCsv(container, 'id,name,age\n1,a,1\n2,b,2\n3,c,3\n4,d,4\n5,e,5')
    expect(previewBodyRows()).toHaveLength(5)
    expect(totalNote()).toBeNull()
    fireEvent.click(document.querySelector('[data-iris-import-preview-cancel]')!)
    importCsv(container, 'id,name,age\n1,a,1\n2,b,2\n3,c,3\n4,d,4\n5,e,5\n6,f,6')
    expect(totalNote()?.textContent).toBe('Total 6')
  })

  it('re-import after cancel shows the NEW file (fresh state per selection)', () => {
    const onImport = vi.fn()
    const { container } = render(
      <IrisTable columns={columns} data={[]} rowKey="id" toolbar={{ onImport }} importPreview />,
    )
    importCsv(container, 'id,name,age\n1,old,1')
    fireEvent.click(document.querySelector('[data-iris-import-preview-cancel]')!)
    importCsv(container, 'id,name,age\n9,fresh,9')
    const rows = previewBodyRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.textContent).toBe('9fresh9')
    expect(document.body.textContent).not.toContain('old')
    expect(onImport).not.toHaveBeenCalled()
  })

  it('quoted fields (embedded comma + newline) survive as raw strings', () => {
    const quoted = 'id,name,age\n1,"Smith, John","line1\nline2"'
    const onImport = vi.fn()
    const { container } = render(
      <IrisTable columns={columns} data={[]} rowKey="id" toolbar={{ onImport }} importPreview />,
    )
    importCsv(container, quoted)
    expect(previewBodyRows()).toHaveLength(1)
    expect(previewBodyRows()[0]?.textContent).toBe('1Smith, Johnline1\nline2')
    fireEvent.click(document.querySelector('[data-iris-import-preview-confirm]')!)
    expect(onImport).toHaveBeenCalledTimes(1)
    expect(onImport.mock.calls[0]![0]).toEqual([
      { id: '1', name: 'Smith, John', age: 'line1\nline2' },
    ])
  })

  it('zh locale renders the preview chrome in Chinese', () => {
    const onImport = vi.fn()
    const { container } = render(
      <IrisI18nProvider
        locale="zh-CN"
        messages={{
          'table.importPreview.title': '导入预览',
          'table.importPreview.confirm': '确认导入',
          'table.importPreview.cancel': '取消',
          'table.total': '共 {total} 条',
        }}
      >
        <IrisTable columns={columns} data={[]} rowKey="id" toolbar={{ onImport }} importPreview />
      </IrisI18nProvider>,
    )
    importCsv(container, 'id,name,age\n1,a,1\n2,b,2\n3,c,3\n4,d,4\n5,e,5\n6,f,6')
    expect(previewModal()?.textContent).toContain('导入预览')
    expect(totalNote()?.textContent).toBe('共 6 条')
    fireEvent.click(document.querySelector('[data-iris-import-preview-cancel]')!)
    expect(onImport).not.toHaveBeenCalled()
  })
})
