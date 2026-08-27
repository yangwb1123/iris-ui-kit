// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { render } from 'svelte/server'
import IrisTable from './IrisTable.svelte'

const columns = [{ key: 'name', title: 'Name' }]
const data = [{ id: 1, name: 'Alpha' }]

describe('Svelte IrisTable undo/redo SSR', () => {
  it('renders enabled controls disabled without browser globals', () => {
    const html = render(IrisTable, {
      props: { columns, data, rowKey: 'id', undo: true },
    }).body
    expect(html).toContain('data-iris-table-undo')
    expect(html).toContain('data-iris-table-redo')
    expect(html).toContain('disabled')
    expect(typeof document).toBe('undefined')
  })
})
