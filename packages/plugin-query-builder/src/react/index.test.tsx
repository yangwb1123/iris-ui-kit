import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { createFilterBuilder, type QueryColumn } from '../core'
import { IrisQueryBuilder } from './index'

afterEach(cleanup)

const columns: QueryColumn[] = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'age', label: 'Age', type: 'number' },
]

describe('IrisQueryBuilder (react)', () => {
  it('adds a rule, edits it, and emits compiled FilterRule[]', () => {
    const onChange = vi.fn()
    const builder = createFilterBuilder({ columns })
    const { container } = render(<IrisQueryBuilder builder={builder} onChange={onChange} />)

    // add a rule
    fireEvent.click(container.querySelector('[data-iris-query-add]')!)
    expect(container.querySelectorAll('[data-iris-query-rule]')).toHaveLength(1)

    // switch to the number column, pick gte, set value 30
    fireEvent.change(container.querySelector('[data-iris-query-column]')!, {
      target: { value: 'age' },
    })
    fireEvent.change(container.querySelector('[data-iris-query-operator]')!, {
      target: { value: 'gte' },
    })
    fireEvent.change(container.querySelector('[data-iris-query-value]')!, {
      target: { value: '30' },
    })

    expect(builder.toFilterRules()).toEqual([{ key: 'age', operator: 'gte', value: 30 }])
    // onChange fired with the compiled, coerced rule
    expect(onChange).toHaveBeenLastCalledWith([{ key: 'age', operator: 'gte', value: 30 }])
  })

  it('removes a rule', () => {
    const builder = createFilterBuilder({ columns })
    const { container } = render(<IrisQueryBuilder builder={builder} />)
    fireEvent.click(container.querySelector('[data-iris-query-add]')!)
    expect(container.querySelectorAll('[data-iris-query-rule]')).toHaveLength(1)
    fireEvent.click(container.querySelector('[data-iris-query-remove]')!)
    expect(container.querySelectorAll('[data-iris-query-rule]')).toHaveLength(0)
  })

  it('adds, edits and removes a nested OR group with recursive output', () => {
    const onQueryChange = vi.fn()
    const builder = createFilterBuilder({ columns })
    const { container } = render(
      <IrisQueryBuilder builder={builder} onQueryChange={onQueryChange} />,
    )

    fireEvent.click(container.querySelector('[data-iris-query-add-group]')!)
    const nested = container.querySelector<HTMLElement>('[data-iris-query-group][data-depth="1"]')!
    fireEvent.change(nested.querySelector('[data-iris-query-combinator]')!, {
      target: { value: 'or' },
    })
    fireEvent.click(nested.querySelector('[data-iris-query-add-rule]')!)
    fireEvent.change(nested.querySelector('[data-iris-query-column]')!, {
      target: { value: 'age' },
    })
    fireEvent.change(nested.querySelector('[data-iris-query-operator]')!, {
      target: { value: 'gte' },
    })
    fireEvent.change(nested.querySelector('[data-iris-query-value]')!, {
      target: { value: '21' },
    })

    expect(builder.toQuery().children[0]).toMatchObject({
      type: 'group',
      combinator: 'or',
      children: [{ key: 'age', operator: 'gte', value: 21 }],
    })
    expect(onQueryChange).toHaveBeenLastCalledWith(builder.toQuery())

    fireEvent.click(nested.querySelector('[data-iris-query-remove-group]')!)
    expect(container.querySelectorAll('[data-iris-query-group]')).toHaveLength(1)
  })

  it('wires typed validation errors with fieldset and described-by semantics', () => {
    const builder = createFilterBuilder({ columns })
    const { container } = render(<IrisQueryBuilder builder={builder} />)
    fireEvent.click(container.querySelector('[data-iris-query-add]')!)

    const input = container.querySelector<HTMLInputElement>('[data-iris-query-value]')!
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const errorId = input.getAttribute('aria-describedby')!
    expect(container.querySelector(`#${errorId}`)?.getAttribute('role')).toBe('alert')
    expect(container.querySelector('fieldset > legend')?.textContent).toBe('Filters')
    expect(container.querySelector('[data-iris-query-remove]')?.getAttribute('type')).toBe('button')
  })

  it('renders a nested query through the server renderer', () => {
    const builder = createFilterBuilder({
      columns,
      initialQuery: {
        id: 'root',
        combinator: 'and',
        children: [
          {
            type: 'group',
            id: 'nested',
            combinator: 'or',
            children: [{ id: 'rule', key: 'name', operator: 'contains', value: 'iris' }],
          },
        ],
      },
    })
    const html = renderToString(<IrisQueryBuilder builder={builder} />)
    expect(html).toContain('data-iris-query-builder')
    expect(html).toContain('data-depth="1"')
    expect(html).toContain('data-node-id="rule"')
  })
})
