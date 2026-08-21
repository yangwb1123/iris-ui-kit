import * as React from 'react'
import { proTableLabel, type ProTableLabels, type ProTableState, type ProTableStore } from '../core'

interface ProTableFilterChipsProps<Row extends Record<string, unknown>> {
  state: ProTableState<Row>
  store: ProTableStore<Row>
}

/** Render active filters and their clear actions below the table. */
export function ProTableFilterChips<Row extends Record<string, unknown>>({
  state,
  store,
}: ProTableFilterChipsProps<Row>): React.ReactElement | null {
  const activeFilters = Object.keys(state.filters).filter((key) => state.filters[key])
  if (activeFilters.length === 0) return null

  const colByKey = new Map(state.columns.map((column) => [column.key, column]))
  return (
    <div
      data-iris-filter-chips=""
      style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', padding: '0.25rem 0' }}
    >
      {activeFilters.map((key) => {
        const column = colByKey.get(key)
        const title = column?.title ?? key
        return (
          <span
            key={key}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
              background: 'var(--iris-pro-table-chip-bg)',
              borderRadius: '9999px',
            }}
          >
            {title}: &ldquo;{state.filters[key]}&rdquo;
            <button
              type="button"
              aria-label={`Clear filter ${title}`}
              onClick={() => store.setFilter(key, '')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              ×
            </button>
          </span>
        )
      })}
      <button
        type="button"
        onClick={() => store.clearFilters()}
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        Clear all ×
      </button>
    </div>
  )
}

interface ProTableFooterProps<Row extends Record<string, unknown>> {
  state: ProTableState<Row>
  store: ProTableStore<Row>
  labels?: ProTableLabels
}

/** Render pager controls shared by the virtualized and regular table paths. */
export function ProTableFooter<Row extends Record<string, unknown>>({
  state,
  store,
  labels,
}: ProTableFooterProps<Row>): React.ReactElement {
  return (
    <div data-iris-pro-table-footer="">
      <button
        type="button"
        disabled={state.page <= 1}
        onClick={() => store.setPage(state.page - 1)}
      >
        {proTableLabel(labels, 'prev')}
      </button>
      <span data-iris-pro-table-page="">
        {state.page} / {store.pageCount()}
      </span>
      <button
        type="button"
        disabled={state.page >= store.pageCount()}
        onClick={() => store.setPage(state.page + 1)}
      >
        {proTableLabel(labels, 'next')}
      </button>
    </div>
  )
}
