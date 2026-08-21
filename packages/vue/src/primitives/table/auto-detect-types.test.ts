import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'

enableAutoUnmount(afterEach)

function header(wrapper: ReturnType<typeof mount>, key: string): HTMLElement {
  return wrapper.find(`[data-iris-table-header="${key}"]`).element as HTMLElement
}

describe('Vue IrisTable autoDetectTypes', () => {
  it('aligns numeric leaves, keeps strings left, and preserves explicit alignment', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: [
          { key: 'age', title: 'Age' },
          { key: 'name', title: 'Name' },
          { key: 'agePinned', title: 'Age pinned', align: 'center' },
        ],
        data: [{ id: 1, age: 32, name: 'Alice', agePinned: 7 }],
        autoDetectTypes: true,
      },
    })

    expect(header(wrapper, 'age').style.justifyContent).toBe('flex-end')
    expect(header(wrapper, 'name').style.justifyContent).toBe('flex-start')
    expect(header(wrapper, 'agePinned').style.justifyContent).toBe('center')
  })

  it('detects grouped leaves while keeping the group header centered', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: [
          {
            key: 'info',
            title: 'Info',
            children: [
              { key: 'age', title: 'Age' },
              { key: 'name', title: 'Name' },
            ],
          },
        ],
        data: [{ id: 1, age: 32, name: 'Alice' }],
        autoDetectTypes: true,
      },
    })

    expect(header(wrapper, 'info').style.justifyContent).toBe('center')
    expect(header(wrapper, 'age').style.justifyContent).toBe('flex-end')
    expect(header(wrapper, 'name').style.justifyContent).toBe('flex-start')
  })

  it('waits for the first non-empty arrival and is off by default', async () => {
    const columns = [{ key: 'age', title: 'Age' }]
    const wrapper = mount(IrisTable, { props: { columns, data: [] } })
    expect(header(wrapper, 'age').style.justifyContent).toBe('flex-start')
    await wrapper.setProps({ data: [{ id: 1, age: 32 }], autoDetectTypes: true })
    await nextTick()
    expect(header(wrapper, 'age').style.justifyContent).toBe('flex-end')
  })
})
