import { afterEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

enableAutoUnmount(afterEach)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function cell(
  wrapper: ReturnType<typeof mount>,
  rowKey: number,
  columnKey: string,
): ReturnType<typeof wrapper.find> {
  return wrapper.find(`[data-iris-table-row-key="${rowKey}"] [data-iris-table-cell="${columnKey}"]`)
}

function marks(
  wrapper: ReturnType<typeof mount>,
  rowKey: number,
  columnKey: string,
): ReturnType<typeof wrapper.findAll> {
  return cell(wrapper, rowKey, columnKey).findAll('mark[data-iris-search-hit]')
}

describe('Vue IrisTable searchHighlight', () => {
  it('is off by default and does not add mark nodes', () => {
    const wrapper = mount(IrisTable, { props: { columns, data: rows, rowKey: 'id' } })
    expect(marks(wrapper, 1, 'name')).toHaveLength(0)
    expect(cell(wrapper, 1, 'name').text()).toBe('Charlie')
  })

  it('fails closed for empty and unmatched queries', () => {
    const empty = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', searchHighlight: '' },
    })
    const unmatched = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', searchHighlight: 'xyz' },
    })
    expect(empty.find('mark[data-iris-search-hit]').exists()).toBe(false)
    expect(unmatched.find('mark[data-iris-search-hit]').exists()).toBe(false)
  })

  it('matches case-insensitively while preserving the displayed casing', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', searchHighlight: 'CHARL' },
    })
    expect(marks(wrapper, 1, 'name')[0]!.text()).toBe('Charl')
    expect(cell(wrapper, 1, 'name').text()).toBe('Charlie')
  })

  it('wraps every non-overlapping literal occurrence', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: [{ id: 1, name: 'banana', age: 1 }],
        rowKey: 'id',
        searchHighlight: 'an',
      },
    })
    const hits = marks(wrapper, 1, 'name')
    expect(hits).toHaveLength(2)
    expect(hits.map((hit) => hit.text())).toEqual(['an', 'an'])
    expect(cell(wrapper, 1, 'name').text()).toBe('banana')
  })

  it('uses the masked formatter display chain before highlighting', () => {
    const formattedColumns: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        mask: (value) => `M:${String(value)}`,
        formatter: (value) => `F:${String(value)}`,
      },
    ]
    const wrapper = mount(IrisTable, {
      props: { columns: formattedColumns, data: rows, rowKey: 'id', searchHighlight: 'm:' },
    })
    expect(marks(wrapper, 1, 'name')[0]!.text()).toBe('M:')
    expect(cell(wrapper, 1, 'name').text()).toBe('F:M:Charlie')
  })

  it('does not stringify numeric raw values into searchable text', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', searchHighlight: '2' },
    })
    expect(marks(wrapper, 1, 'age')).toHaveLength(0)
    expect(cell(wrapper, 1, 'age').text()).toBe('25')
  })

  it('passes non-string formatter nodes through untouched', () => {
    const formattedColumns: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        formatter: () => h('strong', { 'data-formatter-node': '' }, 'Node value'),
      },
    ]
    const wrapper = mount(IrisTable, {
      props: { columns: formattedColumns, data: rows, rowKey: 'id', searchHighlight: 'node' },
    })
    expect(cell(wrapper, 1, 'name').find('[data-formatter-node]').exists()).toBe(true)
    expect(marks(wrapper, 1, 'name')).toHaveLength(0)
  })

  it('leaves custom cell slots outside the highlight path', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', searchHighlight: 'char' },
      slots: {
        'cell.name': ({ value }: { value: unknown }) =>
          h('strong', { 'data-custom-cell': '' }, String(value)),
      },
    })
    expect(cell(wrapper, 1, 'name').find('[data-custom-cell]').exists()).toBe(true)
    expect(marks(wrapper, 1, 'name')).toHaveLength(0)
  })

  it('uses the required data attribute and token-only mark style', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', searchHighlight: 'li' },
    })
    const mark = marks(wrapper, 1, 'name')[0]!
    const style = mark.attributes('style')
    expect(mark.attributes('data-iris-search-hit')).toBe('')
    expect(style).toContain('background: var(--iris-surface-selected, rgba(99,102,241,0.12))')
    expect(style).toContain('color: inherit')
    expect(style).toContain('--iris-radius-sm')
    expect(style).toContain('--iris-space-xxs')
  })

  it('clears marks when the prop is removed', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', searchHighlight: 'li' },
    })
    expect(marks(wrapper, 1, 'name')).toHaveLength(1)
    await wrapper.setProps({ searchHighlight: undefined })
    expect(wrapper.find('mark[data-iris-search-hit]').exists()).toBe(false)
    expect(cell(wrapper, 1, 'name').text()).toBe('Charlie')
  })
})
