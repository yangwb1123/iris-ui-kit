import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  role: string
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25, role: 'Dev' },
  { id: 2, name: 'Alice', age: 32, role: 'Test' },
  { id: 3, name: 'Bob', age: 28, role: 'PM' },
]

const baseColumns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true },
  { key: 'role', title: 'Role', sortable: true },
]

const PLACEHOLDER = 'Natural-language filter, e.g. age > 25 and role = Test'

function bodyRows(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll('[data-iris-table-row]:not([data-iris-table-row=header])'),
  )
}

function bodyNames(): string[] {
  return bodyRows().map((r) => r.textContent ?? '')
}

function queryInput(): HTMLInputElement {
  const el = document.querySelector('[data-iris-table-query-input]')
  expect(el).not.toBeNull()
  return el as HTMLInputElement
}

function errorHint(): HTMLElement | null {
  return document.querySelector('[data-iris-query-error]')
}

interface QueryHarnessProps {
  initialQuery?: string
  onQueryChange?: Mock
  /** Proxy config: remoteFilter is always on so the server owns filtering. */
  proxy?: { query: Mock }
}

/** Fully controlled query harness: the parent owns the string (table is
 * controlled-only for `query`, batch AI). */
function QueryHarness(props: QueryHarnessProps): React.ReactElement {
  const { initialQuery, onQueryChange, proxy } = props
  const [query, setQuery] = React.useState(initialQuery ?? '')
  return (
    <IrisTable
      columns={baseColumns}
      data={rows}
      rowKey="id"
      query={query}
      onQueryChange={(next) => {
        setQuery(next)
        onQueryChange?.(next)
      }}
      proxyConfig={
        proxy
          ? {
              query: proxy.query,
              remoteFilter: true,
            }
          : undefined
      }
    />
  )
}

describe('@iris-ui-kit/react IrisTable query input (batch AI, iris 独有)', () => {
  it('renders the input after the title with the i18n placeholder; typing calls onQueryChange', () => {
    const onQueryChange = vi.fn()
    render(<QueryHarness initialQuery="age > 25" onQueryChange={onQueryChange} />)
    const input = queryInput()
    expect(input.value).toBe('age > 25')
    expect(input.getAttribute('placeholder')).toBe(PLACEHOLDER)
    fireEvent.change(input, { target: { value: 'age > 30' } })
    expect(onQueryChange).toHaveBeenLastCalledWith('age > 30')
  })

  it('filters rows locally with a relational query (age > 25)', () => {
    render(<QueryHarness initialQuery="age > 25" />)
    const names = bodyNames()
    expect(names).toHaveLength(2)
    expect(names.join(' ')).toContain('Alice')
    expect(names.join(' ')).toContain('Bob')
    expect(names.join(' ')).not.toContain('Charlie')
  })

  it('filters rows with an in-list (role in (Test, PM))', () => {
    render(<QueryHarness initialQuery="role in (Test, PM)" />)
    const names = bodyNames()
    expect(names).toHaveLength(2)
    expect(names.join(' ')).toContain('Alice') // Test
    expect(names.join(' ')).toContain('Bob') // PM
    expect(names.join(' ')).not.toContain('Charlie') // Dev
  })

  it('shows the error hint on a bad query and keeps the last valid filter', () => {
    render(<QueryHarness initialQuery="age > 25" />)
    expect(bodyRows()).toHaveLength(2)
    // Break the query: `age >` has no value → parse error.
    fireEvent.change(queryInput(), { target: { value: 'age >' } })
    expect(errorHint()).not.toBeNull()
    expect(errorHint()!.textContent).toContain('Invalid clause')
    // The table keeps filtering by the last valid parse (age > 25).
    expect(bodyRows()).toHaveLength(2)
    expect(bodyNames().join(' ')).not.toContain('Charlie')
  })

  it('proxy mode comma-joins the query into the remote filter map', async () => {
    const query = vi.fn(async () => ({ rows: [], total: 0 }))
    render(<QueryHarness initialQuery="role = Test" proxy={{ query }} />)
    await act(async () => {}) // first autoLoad query settles
    // The FIRST request already carries the parsed substring channel.
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0]?.[0]?.filters).toEqual({ role: 'Test' })
    // An in-list comma-joins exactly like checked filter sets.
    fireEvent.change(queryInput(), {
      target: { value: 'role = Test or role = PM' },
    })
    await act(async () => {})
    const last = query.mock.calls[query.mock.calls.length - 1]?.[0]
    expect(last?.filters).toEqual({ role: 'Test,PM' })
  })

  it('seeds sorting from a `sort by` clause while no sort prop is set', () => {
    render(<QueryHarness initialQuery="sort by name asc" />)
    const names = bodyNames()
    expect(names).toHaveLength(3)
    expect(names[0]).toContain('Alice')
    expect(names[1]).toContain('Bob')
    expect(names[2]).toContain('Charlie')
  })
})
