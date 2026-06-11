import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
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
})
