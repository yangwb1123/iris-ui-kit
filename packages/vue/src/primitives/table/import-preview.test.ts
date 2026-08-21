import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

enableAutoUnmount(afterEach)

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

async function selectCsv(wrapper: ReturnType<typeof mount>, text = csv): Promise<void> {
  stubReader(text)
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [new File([text], 'rows.csv', { type: 'text/csv' })],
  })
  await input.trigger('change')
  await nextTick()
}

describe('IrisTable importPreview', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('previews five rows and confirms the full payload', async () => {
    const onImport = vi.fn()
    const wrapper = mount(IrisTable, {
      props: { columns, data: [], toolbar: { onImport }, importPreview: true },
    })
    await selectCsv(wrapper)
    expect(document.querySelectorAll('[data-iris-import-preview-table] tbody tr')).toHaveLength(5)
    expect(document.querySelector('[data-iris-import-preview-total]')?.textContent).toContain('6')
    expect(document.querySelector('[data-iris-import-preview]')?.getAttribute('aria-modal')).toBe(
      'true',
    )
    expect(onImport).not.toHaveBeenCalled()
    ;(document.querySelector('[data-iris-import-preview-confirm]') as HTMLElement).click()
    await nextTick()
    expect(onImport).toHaveBeenCalledTimes(1)
    expect(onImport.mock.calls[0]?.[0]).toHaveLength(6)
    expect(document.querySelector('[data-iris-import-preview]')).toBeNull()
  })

  it('cancel, Escape, and header-only input never call onImport', async () => {
    const onImport = vi.fn()
    const wrapper = mount(IrisTable, {
      props: { columns, data: [], toolbar: { onImport }, importPreview: true },
    })
    await selectCsv(wrapper, 'id,name,age')
    expect(document.querySelector('[data-iris-import-preview]')).toBeNull()
    await selectCsv(wrapper)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(document.querySelector('[data-iris-import-preview]')).toBeNull()
    expect(onImport).not.toHaveBeenCalled()
  })

  it('keeps the direct import path when preview is disabled', async () => {
    const onImport = vi.fn()
    const wrapper = mount(IrisTable, { props: { columns, data: [], toolbar: { onImport } } })
    await selectCsv(wrapper, 'id,name,age\n1,Ada,20')
    expect(onImport).toHaveBeenCalledWith([{ id: '1', name: 'Ada', age: '20' }])
    expect(document.querySelector('[data-iris-import-preview]')).toBeNull()
  })
})
