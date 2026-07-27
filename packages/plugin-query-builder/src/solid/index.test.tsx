import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TextDecoder, TextEncoder } from 'node:util'
import { createFilterBuilder, type QueryColumn } from '../core'
import { IrisQueryBuilder } from './index'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const columns: QueryColumn[] = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'age', label: 'Age', type: 'number' },
]

describe('IrisQueryBuilder (solid)', () => {
  it('adds a rule, edits it, and emits compiled FilterRule[]', () => {
    const onChange = vi.fn()
    const builder = createFilterBuilder({ columns })
    const { container } = render(() => <IrisQueryBuilder builder={builder} onChange={onChange} />)

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
    fireEvent.input(container.querySelector('[data-iris-query-value]')!, {
      target: { value: '30' },
    })

    expect(builder.toFilterRules()).toEqual([{ key: 'age', operator: 'gte', value: 30 }])
    // onChange fired with the compiled, coerced rule
    expect(onChange).toHaveBeenLastCalledWith([{ key: 'age', operator: 'gte', value: 30 }])
  })

  it('removes a rule', () => {
    const builder = createFilterBuilder({ columns })
    const { container } = render(() => <IrisQueryBuilder builder={builder} />)
    fireEvent.click(container.querySelector('[data-iris-query-add]')!)
    expect(container.querySelectorAll('[data-iris-query-rule]')).toHaveLength(1)
    fireEvent.click(container.querySelector('[data-iris-query-remove]')!)
    expect(container.querySelectorAll('[data-iris-query-rule]')).toHaveLength(0)
  })

  it('adds, edits and removes a nested OR group with recursive output', () => {
    const onQueryChange = vi.fn()
    const builder = createFilterBuilder({ columns })
    const { container } = render(() => (
      <IrisQueryBuilder builder={builder} onQueryChange={onQueryChange} />
    ))

    fireEvent.click(container.querySelector('[data-iris-query-add-group]')!)
    const nested = (): HTMLElement =>
      container.querySelector<HTMLElement>('[data-iris-query-group][data-depth="1"]')!
    fireEvent.change(nested().querySelector('[data-iris-query-combinator]')!, {
      target: { value: 'or' },
    })
    fireEvent.click(nested().querySelector('[data-iris-query-add-rule]')!)
    fireEvent.change(nested().querySelector('[data-iris-query-column]')!, {
      target: { value: 'age' },
    })
    fireEvent.change(nested().querySelector('[data-iris-query-operator]')!, {
      target: { value: 'gte' },
    })
    fireEvent.input(nested().querySelector('[data-iris-query-value]')!, {
      target: { value: '21' },
    })

    expect(builder.toQuery().children[0]).toMatchObject({
      type: 'group',
      combinator: 'or',
      children: [{ key: 'age', operator: 'gte', value: 21 }],
    })
    expect(onQueryChange).toHaveBeenLastCalledWith(builder.toQuery())

    fireEvent.click(nested().querySelector('[data-iris-query-remove-group]')!)
    expect(container.querySelectorAll('[data-iris-query-group]')).toHaveLength(1)
  })

  it('wires typed validation errors to accessible controls', () => {
    const builder = createFilterBuilder({ columns })
    const { container } = render(() => <IrisQueryBuilder builder={builder} />)
    fireEvent.click(container.querySelector('[data-iris-query-add]')!)

    const input = container.querySelector<HTMLInputElement>('[data-iris-query-value]')!
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const errorId = input.getAttribute('aria-describedby')!
    expect(container.querySelector(`#${errorId}`)?.getAttribute('role')).toBe('alert')
    expect(container.querySelector('fieldset > legend')?.textContent).toBe('Filters')
  })

  it('compiles the recursive component through the Solid SSR transform', async () => {
    // jsdom supplies cross-realm encoding classes that violate an esbuild
    // invariant while the Solid/Vite transformer loads.
    vi.stubGlobal('TextEncoder', TextEncoder)
    vi.stubGlobal('TextDecoder', TextDecoder)
    vi.stubGlobal(
      'Uint8Array',
      Object.getPrototypeOf(Buffer.prototype).constructor as Uint8ArrayConstructor,
    )
    const { default: solid } = await import('vite-plugin-solid')
    const filename = resolve(process.cwd(), 'src/solid/index.tsx')
    const source = readFileSync(filename, 'utf8')
    const transform = solid({ ssr: true }).transform
    if (typeof transform !== 'function') throw new Error('Solid SSR transform is unavailable')

    const result = await transform(source, filename, { ssr: true })
    const code = typeof result === 'string' ? result : result?.code
    expect(code).toContain('solid-js/web')
    expect(code).toContain('data-iris-query-builder')
    expect(code).toContain('data-iris-query-group')
    expect(code).not.toContain('document.')
  })
})
