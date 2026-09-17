import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/svelte'
import TableI18nHarness from './TableI18nHarness.svelte'

afterEach(cleanup)

describe('@iris-ui-kit/svelte IrisTable i18n parity', () => {
  it('updates table views, resize handles, pinned drag, and pager chrome after a locale switch', async () => {
    const query = vi.fn(async () => ({
      rows: [
        { id: 1, name: 'Alice', age: 1 },
        { id: 2, name: 'Bob', age: 3 },
      ],
      total: 2,
    }))
    const view = render(TableI18nHarness, { props: { locale: 'en-US', query } })

    await waitFor(() =>
      expect(view.container.querySelector('[data-iris-table-cell="age"]')).not.toBeNull(),
    )
    expect(
      view.container.querySelector('[data-iris-table-views]')?.getAttribute('aria-label'),
    ).toBe('Table views')
    expect(
      view.container
        .querySelector('[data-iris-table-resize-handle][data-column-key="age"]')
        ?.getAttribute('aria-label'),
    ).toBe('Resize Age')
    expect(
      view.container.querySelector('[data-iris-pinned-drag-handle]')?.getAttribute('aria-label'),
    ).toBe('Adjust pinned column count at Name')
    expect(
      view.container.querySelector('[data-iris-table-views] option[value=""]')?.textContent,
    ).toBe('View name…')
    expect(
      view.container
        .querySelector('[data-iris-table-pager] [data-iris-select-trigger]')
        ?.getAttribute('aria-label'),
    ).toBe('Page size')
    expect(
      view.container
        .querySelector('[data-iris-table-pager] [data-iris-pagination]')
        ?.getAttribute('aria-label'),
    ).toBe('Pagination')

    await view.rerender({ locale: 'zh-CN', query })
    await waitFor(() =>
      expect(
        view.container.querySelector('[data-iris-table-views]')?.getAttribute('aria-label'),
      ).toBe('表格视图'),
    )
    expect(
      view.container
        .querySelector('[data-iris-table-resize-handle][data-column-key="age"]')
        ?.getAttribute('aria-label'),
    ).toBe('调整 Age 列宽')
    expect(
      view.container.querySelector('[data-iris-pinned-drag-handle]')?.getAttribute('aria-label'),
    ).toBe('调整 Name 固定列数量')
    expect(
      view.container.querySelector('[data-iris-table-views] option[value=""]')?.textContent,
    ).toBe('视图名称…')
    expect(
      view.container
        .querySelector('[data-iris-table-pager] [data-iris-select-trigger]')
        ?.getAttribute('aria-label'),
    ).toBe('每页数量')
    expect(
      view.container
        .querySelector('[data-iris-table-pager] [data-iris-pagination]')
        ?.getAttribute('aria-label'),
    ).toBe('分页')
  })

  it('lets user messages override plugin table translations', async () => {
    const query = vi.fn(async () => ({ rows: [{ id: 1, name: 'Alice', age: 1 }], total: 1 }))
    const view = render(TableI18nHarness, {
      props: {
        locale: 'zh-CN',
        query,
        messages: {
          'table.views.label': 'Custom table views',
          'table.resizeColumn': 'Resize field {column}',
        },
      },
    })

    await waitFor(() =>
      expect(view.container.querySelector('[data-iris-table-views]')).not.toBeNull(),
    )
    expect(
      view.container.querySelector('[data-iris-table-views]')?.getAttribute('aria-label'),
    ).toBe('Custom table views')
    expect(
      view.container
        .querySelector('[data-iris-table-resize-handle][data-column-key="age"]')
        ?.getAttribute('aria-label'),
    ).toBe('Resize field Age')
  })
})
