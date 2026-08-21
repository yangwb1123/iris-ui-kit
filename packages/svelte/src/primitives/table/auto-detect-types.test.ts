import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'

afterEach(cleanup)

function header(container: HTMLElement, key: string): HTMLElement {
  return container.querySelector(`[data-iris-table-header="${key}"]`) as HTMLElement
}

describe('Svelte IrisTable autoDetectTypes', () => {
  it('aligns numeric leaves, keeps strings left, and preserves explicit alignment', () => {
    const { container } = render(IrisTable, {
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

    expect(header(container, 'age').style.justifyContent).toBe('flex-end')
    expect(header(container, 'name').style.justifyContent).toBe('flex-start')
    expect(header(container, 'agePinned').style.justifyContent).toBe('center')
  })

  it('detects grouped leaves while keeping the group header centered', () => {
    const { container } = render(IrisTable, {
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

    expect(header(container, 'info').style.justifyContent).toBe('center')
    expect(header(container, 'age').style.justifyContent).toBe('flex-end')
    expect(header(container, 'name').style.justifyContent).toBe('flex-start')
  })

  it('waits for the first non-empty arrival and is off by default', async () => {
    const view = render(IrisTable, {
      props: { columns: [{ key: 'age', title: 'Age' }], data: [], autoDetectTypes: true },
    })
    expect(header(view.container, 'age').style.justifyContent).toBe('flex-start')
    await view.rerender({
      columns: [{ key: 'age', title: 'Age' }],
      data: [{ id: 1, age: 32 }],
      autoDetectTypes: true,
    })
    await waitFor(() => expect(header(view.container, 'age').style.justifyContent).toBe('flex-end'))
  })
})
