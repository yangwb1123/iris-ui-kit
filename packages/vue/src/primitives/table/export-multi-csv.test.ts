import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn, IrisTableExpose } from './types'

enableAutoUnmount(afterEach)

type Row = { id: number; name: string }
const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]
const rows: Row[] = [
  { id: 1, name: 'Alpha' },
  { id: 2, name: 'Beta' },
]

describe('IrisTable expose.exportMultiCsv', () => {
  it('falls back byte-for-byte when exportNames is absent or empty', () => {
    const base = mount(IrisTable, { props: { columns, data: rows } })
    const empty = mount(IrisTable, { props: { columns, data: rows, exportNames: [] } })
    const baseExpose = base.vm as unknown as IrisTableExpose<Row>
    const emptyExpose = empty.vm as unknown as IrisTableExpose<Row>

    expect(baseExpose.exportMultiCsv()).toBe('Name\nAlpha\nBeta')
    expect(emptyExpose.exportMultiCsv()).toBe(emptyExpose.exportCurrentViewCsv())
  })

  it('joins ordered named refs, skips empty names, and keeps bare-row headers', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        exportNames: [
          { key: 'regions', ref: () => [{ code: 'R1', label: 'North' }] },
          { key: '', ref: () => [{ ignored: true }] },
          { key: 'empty', ref: () => [] },
        ],
      },
    })
    const expose = wrapper.vm as unknown as IrisTableExpose<Row>

    expect(expose.exportMultiCsv()).toBe(
      '# current\nName\nAlpha\nBeta\n\n# regions\ncode,label\nR1,North\n\n# empty',
    )
  })

  it('reads the latest ref configuration and neutralizes formula-looking ref cells', async () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        exportNames: [{ key: 'old', ref: () => [{ value: 'old' }] }],
      },
    })
    const expose = wrapper.vm as unknown as IrisTableExpose<Row>

    await wrapper.setProps({
      exportNames: [{ key: 'new', ref: () => [{ value: '=HYPERLINK("x")' }] }],
    })
    await nextTick()

    expect(expose.exportMultiCsv()).toBe(
      '# current\nName\nAlpha\nBeta\n\n# new\nvalue\n"\'=HYPERLINK(""x"")"',
    )
  })
})
