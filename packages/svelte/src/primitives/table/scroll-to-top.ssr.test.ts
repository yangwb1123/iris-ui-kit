// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { render } from 'svelte/server'
import IrisTable from './IrisTable.svelte'

describe('Svelte IrisTable scrollToTop SSR', () => {
  it('does not touch browser globals or render a client-only control', () => {
    const { body } = render(IrisTable, {
      props: {
        columns: [{ key: 'name', title: 'Name' }],
        data: [{ id: 1, name: 'Alice' }],
        rowKey: 'id',
        scrollToTop: true,
      },
    })
    expect(body).toContain('data-iris-table')
    expect(body).not.toContain('data-iris-back-top-table')
  })
})
