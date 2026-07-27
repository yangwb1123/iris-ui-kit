import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compile } from 'svelte/compiler'
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

  it('adds, edits and removes a nested OR group with recursive output', async () => {
    const onQueryChange = vi.fn()
    const builder = createFilterBuilder({ columns })
    const { container } = render(IrisQueryBuilder, {
      props: { builder, onQueryChange },
    })

    await fireEvent.click(container.querySelector('[data-iris-query-add-group]')!)
    const nested = container.querySelector<HTMLElement>('[data-iris-query-group][data-depth="1"]')!
    await fireEvent.change(nested.querySelector('[data-iris-query-combinator]')!, {
      target: { value: 'or' },
    })
    await fireEvent.click(nested.querySelector('[data-iris-query-add-rule]')!)
    await fireEvent.change(nested.querySelector('[data-iris-query-column]')!, {
      target: { value: 'age' },
    })
    await fireEvent.change(nested.querySelector('[data-iris-query-operator]')!, {
      target: { value: 'gte' },
    })
    await fireEvent.input(nested.querySelector('[data-iris-query-value]')!, {
      target: { value: '21' },
    })

    expect(builder.toQuery().children[0]).toMatchObject({
      type: 'group',
      combinator: 'or',
      children: [{ key: 'age', operator: 'gte', value: 21 }],
    })
    expect(onQueryChange).toHaveBeenLastCalledWith(builder.toQuery())

    await fireEvent.click(nested.querySelector('[data-iris-query-remove-group]')!)
    expect(container.querySelectorAll('[data-iris-query-group]')).toHaveLength(1)
  })

  it('wires typed validation errors to accessible controls', async () => {
    const builder = createFilterBuilder({ columns })
    const { container } = render(IrisQueryBuilder, { props: { builder } })
    await fireEvent.click(container.querySelector('[data-iris-query-add]')!)

    const input = container.querySelector<HTMLInputElement>('[data-iris-query-value]')!
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const errorId = input.getAttribute('aria-describedby')!
    expect(container.querySelector(`#${errorId}`)?.getAttribute('role')).toBe('alert')
    expect(container.querySelector('fieldset > legend')?.textContent).toBe('Filters')
  })

  it('compiles the recursive component through the Svelte server compiler', () => {
    const filename = resolve(process.cwd(), 'src/svelte/IrisQueryBuilder.svelte')
    const source = readFileSync(filename, 'utf8')
    const result = compile(source, {
      filename,
      generate: 'server',
      dev: true,
    })

    expect(result.js.code).toContain('svelte/internal/server')
    expect(result.js.code).toContain('data-iris-query-builder')
    expect(result.js.code).toContain('data-iris-query-group')
    expect(result.js.code).not.toContain('document.')
  })
})
