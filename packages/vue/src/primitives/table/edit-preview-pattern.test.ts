import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

enableAutoUnmount(afterEach)

type Row = { id: number; city: string; amount: number }
const columns: IrisTableColumn<Row>[] = [
  { key: 'city', title: 'City', editable: true, formatter: (value) => `F:${String(value)}` },
  {
    key: 'amount',
    title: 'Amount',
    editable: true,
    editor: 'number',
    formatter: (value) => Number(value).toFixed(1),
  },
]
const rows: Row[] = [
  { id: 1, city: 'Paris', amount: 2 },
  { id: 2, city: 'Berlin', amount: 3 },
  { id: 3, city: 'Paris', amount: 4 },
]

const cell = (wrapper: ReturnType<typeof mount>, id: number, key: string) =>
  wrapper.find(`[data-iris-table-row-key="${id}"] [data-iris-table-cell="${key}"]`)

describe('Vue IrisTable editPreview and pattern feedback', () => {
  it('previews formatter output and updates with the draft', async () => {
    const wrapper = mount(IrisTable, { props: { columns, data: rows, editPreview: true } })
    await cell(wrapper, 1, 'city').trigger('dblclick')
    expect(wrapper.find('[data-iris-edit-preview]').text()).toBe('F:Paris')
    await wrapper.find('[data-iris-table-editor]').setValue('Rome')
    expect(wrapper.find('[data-iris-edit-preview]').text()).toBe('F:Rome')
  })

  it('matches raw values in the edited column and patternFill aliases pattern', async () => {
    const wrapper = mount(IrisTable, { props: { columns, data: rows, patternFill: true } })
    await cell(wrapper, 1, 'city').trigger('dblclick')
    expect(cell(wrapper, 1, 'city').attributes('data-iris-input-hint')).toBeUndefined()
    expect(cell(wrapper, 3, 'city').attributes('data-iris-input-hint')).toBe('true')
    await wrapper.find('[data-iris-table-editor]').setValue('Berlin')
    await nextTick()
    expect(cell(wrapper, 2, 'city').attributes('data-iris-input-hint')).toBe('true')
    expect(cell(wrapper, 3, 'city').attributes('data-iris-input-hint')).toBeUndefined()
  })

  it('is fail-closed when preview is off and does not hint an empty draft', async () => {
    const wrapper = mount(IrisTable, { props: { columns, data: rows, pattern: true } })
    await cell(wrapper, 1, 'city').trigger('dblclick')
    expect(wrapper.find('[data-iris-edit-preview]').exists()).toBe(false)
    await wrapper.find('[data-iris-table-editor]').setValue('')
    expect(wrapper.findAll('[data-iris-input-hint="true"]')).toHaveLength(0)
  })
})
