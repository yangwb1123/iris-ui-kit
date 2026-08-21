import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn, IrisTableExpose } from './types'

enableAutoUnmount(afterEach)

type Row = { id: number; name: string }
const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]

describe('IrisTable expose.compareStates', () => {
  it('compares exported-state objects independently of key order', () => {
    const wrapper = mount(IrisTable, { props: { columns, data: [{ id: 1, name: 'A' }] } })
    const expose = wrapper.vm as unknown as IrisTableExpose<Row>

    expect(expose.compareStates('{"b":2,"a":1}', '{"a":1,"b":2}')).toBe('')
    expect(
      expose.compareStates('{"sort":{"direction":"asc"}}', '{"sort":{"direction":"desc"}}'),
    ).toBe('~ sort.direction: "asc" → "desc"')
  })

  it('reports directional additions and removals', () => {
    const wrapper = mount(IrisTable, { props: { columns, data: [] } })
    const expose = wrapper.vm as unknown as IrisTableExpose<Row>

    expect(expose.compareStates('{}', '{"pageSize":25}')).toBe('+ pageSize: 25')
    expect(expose.compareStates('{"pageSize":25}', '{}')).toBe('- pageSize: 25')
  })

  it('returns the literal fail-closed result for invalid JSON', () => {
    const wrapper = mount(IrisTable, { props: { columns, data: [] } })
    const expose = wrapper.vm as unknown as IrisTableExpose<Row>
    expect(expose.compareStates('{bad', '{}')).toBe('! compareStates: invalid JSON')
  })
})
