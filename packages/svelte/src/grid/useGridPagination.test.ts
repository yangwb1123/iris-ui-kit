import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import GridPaginationHarness from './GridPaginationHarness.svelte'

describe('useGridPagination', () => {
  it('hands controlled pagination changes from props into the core model', async () => {
    const view = render(GridPaginationHarness, { page: 1, total: 20 })
    expect(view.getByTestId('page').textContent).toBe('1')

    await view.rerender({ page: 2, total: 20 })

    expect(view.getByTestId('page').textContent).toBe('2')
  })
})
