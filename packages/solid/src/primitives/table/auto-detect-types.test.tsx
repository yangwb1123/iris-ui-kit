import { afterEach, describe, expect, it } from 'vitest'
import { createSignal } from 'solid-js'
import { cleanup, render, waitFor } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'

afterEach(cleanup)

type Row = { id: number; name: string; age: number | string }

function header(container: HTMLElement, key: string): HTMLElement {
  return container.querySelector(`[data-iris-table-header="${key}"]`) as HTMLElement
}

describe('Solid IrisTable autoDetectTypes', () => {
  it('aligns numeric leaves, keeps strings left, and preserves explicit alignment', () => {
    const { container } = render(() => (
      <IrisTable
        columns={[
          { key: 'age', title: 'Age' },
          { key: 'name', title: 'Name' },
          { key: 'agePinned', title: 'Age pinned', align: 'center' },
        ]}
        data={[{ id: 1, age: 32, name: 'Alice', agePinned: 7 }]}
        autoDetectTypes
      />
    ))

    expect(header(container, 'age').style.justifyContent).toBe('flex-end')
    expect(header(container, 'name').style.justifyContent).toBe('flex-start')
    expect(header(container, 'agePinned').style.justifyContent).toBe('center')
  })

  it('detects grouped leaves while keeping the group header centered', () => {
    const { container } = render(() => (
      <IrisTable
        columns={[
          {
            key: 'info',
            title: 'Info',
            children: [
              { key: 'age', title: 'Age' },
              { key: 'name', title: 'Name' },
            ],
          },
        ]}
        data={[{ id: 1, age: 32, name: 'Alice' }]}
        autoDetectTypes
      />
    ))

    expect(header(container, 'info').style.justifyContent).toBe('center')
    expect(header(container, 'age').style.justifyContent).toBe('flex-end')
    expect(header(container, 'name').style.justifyContent).toBe('flex-start')
  })

  it('waits for the first non-empty arrival and is off by default', async () => {
    const [rows, setRows] = createSignal<Row[]>([])
    const { container } = render(() => (
      <IrisTable columns={[{ key: 'age', title: 'Age' }]} data={rows()} autoDetectTypes />
    ))
    expect(header(container, 'age').style.justifyContent).toBe('flex-start')
    setRows([{ id: 1, age: 32, name: 'Alice' }])
    await waitFor(() => expect(header(container, 'age').style.justifyContent).toBe('flex-end'))
  })
})
