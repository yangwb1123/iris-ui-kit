// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { render } from 'svelte/server'
import IrisTable from './IrisTable.svelte'
import Harness from './batch-fade-svelte-hydration-harness.svelte'
import { BATCH_FADE_SVELTE_SSR_FIXTURE } from './batch-fade-svelte.ssr-fixture'

const columns = [
  { key: 'name', title: 'Name', width: 100 },
  { key: 'age', title: 'Age', width: 120 },
]
const data = [{ id: 1, name: 'Alice', age: 25 }]

describe('Svelte IrisTable columnFade SSR', () => {
  it('keeps the hydration fixture synchronized with current SSR markup', () => {
    const html = render(Harness, { props: {} }).body
    expect(html).toBe(BATCH_FADE_SVELTE_SSR_FIXTURE)
  })

  it('keeps initial visibility settled and browser-free when enabled', () => {
    const html = render(IrisTable, {
      props: {
        columns,
        data,
        rowKey: 'id',
        columnVisibility: { age: false },
        columnFade: true,
      },
    }).body
    expect(html).toContain('data-iris-table')
    expect(html).toContain('data-iris-table-cell="name"')
    expect(html).not.toContain('data-iris-column-fade-active')
    expect(html).not.toContain('data-iris-column-fade=')
    expect(html).not.toContain('data-iris-table-cell="age"')
    expect(typeof document).toBe('undefined')
    expect(typeof window).toBe('undefined')
  })

  it('keeps the default-off path identical to settled visibility', () => {
    const html = render(IrisTable, {
      props: { columns, data, rowKey: 'id', columnVisibility: { age: false } },
    }).body
    expect(html).not.toContain('data-iris-column-fade-active')
    expect(html).not.toContain('data-iris-column-fade=')
    expect(html).not.toContain('data-iris-table-cell="age"')
  })
})
