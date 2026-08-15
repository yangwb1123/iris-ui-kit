import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn, IrisTablePresenceEntry } from './types'

afterEach(() => {
  cleanup()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Alexandra', age: 25 },
  { id: 2, name: 'Bob', age: 32 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function cell(rowId: number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function labelsOf(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll('[data-iris-presence-label]'))
}

describe('@iris-ui-kit/react IrisTable collaborative presence (batch BD, iris 独有)', () => {
  it('a presence entry renders the cursor outline + corner name label', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        presence={[{ id: 'u1', name: 'Alice', color: '#ff8800', cellKey: '1::name' }]}
      />,
    )
    const c = cell(1, 'name')
    expect(c.getAttribute('data-iris-presence')).toBe('true')
    expect(c.style.outline).toBe('2px solid #ff8800')
    expect(c.style.position).toBe('relative')
    const labels = labelsOf(c)
    expect(labels).toHaveLength(1)
    expect(labels[0].textContent).toBe('Alice')
    expect(labels[0].getAttribute('data-iris-presence-id')).toBe('u1')
    expect(labels[0].getAttribute('data-iris-presence-name')).toBe('Alice')
    // Un-presenced cells stay clean.
    expect(cell(1, 'age').getAttribute('data-iris-presence')).toBeNull()
    expect(labelsOf(cell(1, 'age'))).toHaveLength(0)
  })

  it('cellKey uses the `${rowKey}::${columnKey}` delimiter (same as cellId)', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        presence={[{ id: 'u2', name: 'Bob', color: '#22cc88', cellKey: '2::age' }]}
      />,
    )
    const c = cell(2, 'age')
    expect(c.getAttribute('data-iris-presence')).toBe('true')
    expect(c.style.outline).toBe('2px solid #22cc88')
    expect(labelsOf(c)[0].textContent).toBe('Bob')
    expect(cell(2, 'name').getAttribute('data-iris-presence')).toBeNull()
  })

  it('multiple entries on different cells each render their own cursor', () => {
    const presence: IrisTablePresenceEntry[] = [
      { id: 'u1', name: 'Alice', color: '#ff8800', cellKey: '1::name' },
      { id: 'u2', name: 'Bob', color: '#22cc88', cellKey: '2::age' },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" presence={presence} />)
    expect(cell(1, 'name').style.outline).toBe('2px solid #ff8800')
    expect(labelsOf(cell(1, 'name'))[0].textContent).toBe('Alice')
    expect(cell(2, 'age').style.outline).toBe('2px solid #22cc88')
    expect(labelsOf(cell(2, 'age'))[0].textContent).toBe('Bob')
  })

  it('same-cell stacking: first entry wins the outline, both labels render', () => {
    const presence: IrisTablePresenceEntry[] = [
      { id: 'u1', name: 'Alice', color: '#ff8800', cellKey: '1::name' },
      { id: 'u2', name: 'Bob', color: '#22cc88', cellKey: '1::name' },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" presence={presence} />)
    const c = cell(1, 'name')
    expect(c.style.outline).toBe('2px solid #ff8800')
    const labels = labelsOf(c)
    expect(labels).toHaveLength(2)
    expect(labels[0].textContent).toBe('Alice')
    expect(labels[1].textContent).toBe('Bob')
    // Cascade: the second label sits below the first.
    expect(labels[0].style.top).toBe('0px')
    expect(labels[1].style.top).toBe('14px')
  })

  it('no presence prop → no cursor, no label, no relative positioning', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    for (const r of [1, 2]) {
      for (const k of ['name', 'age']) {
        const c = cell(r, k)
        expect(c.getAttribute('data-iris-presence')).toBeNull()
        expect(c.style.outline).toBe('')
        expect(labelsOf(c)).toHaveLength(0)
      }
    }
  })

  it('an empty presence array renders nothing', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" presence={[]} />)
    expect(cell(1, 'name').getAttribute('data-iris-presence')).toBeNull()
    expect(labelsOf(cell(1, 'name'))).toHaveLength(0)
  })

  it('a NEW presence array reference re-renders (controlled prop contract)', () => {
    const { rerender } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        presence={[{ id: 'u1', name: 'Alice', color: '#ff8800', cellKey: '1::name' }]}
      />,
    )
    expect(cell(1, 'name').style.outline).toBe('2px solid #ff8800')
    act(() => {
      rerender(
        <IrisTable
          columns={cols}
          data={rows}
          rowKey="id"
          presence={[{ id: 'u1', name: 'Alice', color: '#2244ff', cellKey: '1::name' }]}
        />,
      )
    })
    expect(cell(1, 'name').style.outline).toBe('2px solid #2244ff')
    expect(cell(1, 'name').getAttribute('data-iris-presence')).toBe('true')
    // Removing the entry clears the cell entirely.
    act(() => {
      rerender(<IrisTable columns={cols} data={rows} rowKey="id" presence={[]} />)
    })
    expect(cell(1, 'name').getAttribute('data-iris-presence')).toBeNull()
    expect(cell(1, 'name').style.outline).toBe('')
    expect(labelsOf(cell(1, 'name'))).toHaveLength(0)
  })

  it('an unknown cellKey is inert — no cell is affected', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        presence={[{ id: 'u1', name: 'Alice', color: '#ff8800', cellKey: '99::nope' }]}
      />,
    )
    for (const r of [1, 2]) {
      for (const k of ['name', 'age']) {
        expect(cell(r, k).getAttribute('data-iris-presence')).toBeNull()
        expect(labelsOf(cell(r, k))).toHaveLength(0)
      }
    }
  })

  it('the label is token-driven with the entry color as its background', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        presence={[{ id: 'u1', name: 'Alice', color: '#ff8800', cellKey: '1::name' }]}
      />,
    )
    const label = labelsOf(cell(1, 'name'))[0]
    // jsdom normalizes hex to rgb().
    expect(label.style.background).toBe('rgb(255, 136, 0)')
    expect(label.style.fontSize).toBe('var(--iris-font-size-xs, 12px)')
    expect(label.style.padding).toBe('0 var(--iris-space-xxs, 4px)')
    expect(label.style.color).toBe('var(--iris-primary-foreground, #fff)')
    expect(label.style.position).toBe('absolute')
    // RTL-safe anchor: logical inset-inline-start, no hardcoded left/right.
    expect(label.style.insetInlineStart).toBe('0')
    expect(label.style.pointerEvents).toBe('none')
    // Outline width is fixed at 2px.
    expect(cell(1, 'name').style.outline).toBe('2px solid #ff8800')
  })
})
