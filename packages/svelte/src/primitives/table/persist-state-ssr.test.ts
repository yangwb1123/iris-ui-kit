// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { render } from 'svelte/server'
import IrisTable from './IrisTable.svelte'

const columns = [{ key: 'name', title: 'Name' }]
const rows = [{ id: 1, name: 'A' }]

describe('@iris-ui-kit/svelte IrisTable persistState SSR guard (batch EJ)', () => {
  it('server render never touches storage (window guard)', () => {
    const getItem = vi.fn(() => '{"sort":{"key":"name","direction":"asc"}}')
    const setItem = vi.fn()
    // jsdom-less node env: no window — the parse is a strict no-op and the
    // restore/save effects never run server-side.
    const { body } = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        persistState: { storage: { getItem, setItem } },
      },
    })
    expect(body).toContain('data-iris-table')
    expect(getItem).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
  })
})
