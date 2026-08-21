import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

enableAutoUnmount(afterEach)

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const rows: Row[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
]

describe('IrisTable unique edit rule', () => {
  it('checks the current rows and keeps the editor open on duplicates', async () => {
    const columns: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [{ unique: true }],
      },
    ]
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id' },
    })

    await wrapper.findAll('[data-iris-table-row]')[0]!.find('[role="cell"]').trigger('dblclick')
    const editor = wrapper.find('[data-iris-table-editor]')
    await editor.setValue('Bob')
    await editor.trigger('keydown', { key: 'Enter' })
    await nextTick()

    expect(wrapper.find('[data-iris-table-editor]').exists()).toBe(true)
    expect(wrapper.find('[data-iris-table-editor]').attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('[data-iris-table-editor-error]').text()).toBe('Value must be unique')

    await wrapper.find('[data-iris-table-editor]').setValue('Cara')
    await wrapper.find('[data-iris-table-editor]').trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(wrapper.find('[data-iris-table-editor]').exists()).toBe(false)
  })
})
