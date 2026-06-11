import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { createFilterBuilder, type QueryColumn } from '../core'
import IrisQueryBuilder from './IrisQueryBuilder.svelte'

const columns: QueryColumn[] = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'age', label: 'Age', type: 'number' },
]

describe('IrisQueryBuilder (svelte)', () => {
  it('adds a rule, edits it, and emits compiled FilterRule[]', async () => {
    const onChange = vi.fn()
    const builder = createFilterBuilder({ columns })
    const { container } = render(IrisQueryBuilder, { props: { builder, onChange } })

    // add a rule
    await fireEvent.click(container.querySelector('[data-iris-query-add]')!)
    expect(container.querySelectorAll('[data-iris-query-rule]')).toHaveLength(1)

    // switch to the number column, pick gte, set value 30
    await fireEvent.change(container.querySelector('[data-iris-query-column]')!, {
      target: { value: 'age' },
    })
    await fireEvent.change(container.querySelector('[data-iris-query-operator]')!, {
      target: { value: 'gte' },
    })
    await fireEvent.input(container.querySelector('[data-iris-query-value]')!, {
      target: { value: '30' },
    })

    expect(builder.toFilterRules()).toEqual([{ key: 'age', operator: 'gte', value: 30 }])
    // onChange fired with the compiled, coerced rule
    expect(onChange).toHaveBeenLastCalledWith([{ key: 'age', operator: 'gte', value: 30 }])
  })

  it('removes a rule', async () => {
    const builder = createFilterBuilder({ columns })
    const { container } = render(IrisQueryBuilder, { props: { builder } })
    await fireEvent.click(container.querySelector('[data-iris-query-add]')!)
    expect(container.querySelectorAll('[data-iris-query-rule]')).toHaveLength(1)
    await fireEvent.click(container.querySelector('[data-iris-query-remove]')!)
    expect(container.querySelectorAll('[data-iris-query-rule]')).toHaveLength(0)
  })
})
