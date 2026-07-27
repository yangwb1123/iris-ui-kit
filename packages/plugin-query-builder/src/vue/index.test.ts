import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createSSRApp, h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createFilterBuilder, type QueryColumn } from '../core'
import { IrisQueryBuilder } from './index'

const columns: QueryColumn[] = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'age', label: 'Age', type: 'number' },
]

describe('IrisQueryBuilder (vue)', () => {
  it('adds a rule, edits it, and emits compiled FilterRule[]', async () => {
    const onChange = vi.fn()
    const builder = createFilterBuilder({ columns })
    const wrapper = mount(IrisQueryBuilder, { props: { builder, onChange } })

    // add a rule
    await wrapper.find('[data-iris-query-add]').trigger('click')
    await nextTick()
    expect(wrapper.findAll('[data-iris-query-rule]')).toHaveLength(1)

    // switch to the number column, pick gte, set value 30
    await wrapper.find('[data-iris-query-column]').setValue('age')
    await nextTick()
    await wrapper.find('[data-iris-query-operator]').setValue('gte')
    await nextTick()
    await wrapper.find('[data-iris-query-value]').setValue('30')
    await nextTick()

    expect(builder.toFilterRules()).toEqual([{ key: 'age', operator: 'gte', value: 30 }])
    // onChange fired with the compiled, coerced rule
    expect(onChange).toHaveBeenLastCalledWith([{ key: 'age', operator: 'gte', value: 30 }])

    wrapper.unmount()
  })

  it('removes a rule', async () => {
    const builder = createFilterBuilder({ columns })
    const wrapper = mount(IrisQueryBuilder, { props: { builder } })

    await wrapper.find('[data-iris-query-add]').trigger('click')
    await nextTick()
    expect(wrapper.findAll('[data-iris-query-rule]')).toHaveLength(1)

    await wrapper.find('[data-iris-query-remove]').trigger('click')
    await nextTick()
    expect(wrapper.findAll('[data-iris-query-rule]')).toHaveLength(0)

    wrapper.unmount()
  })

  it('adds, edits and removes a nested OR group with recursive output', async () => {
    const onQueryChange = vi.fn()
    const builder = createFilterBuilder({ columns })
    const wrapper = mount(IrisQueryBuilder, { props: { builder, onQueryChange } })

    await wrapper.find('[data-iris-query-add-group]').trigger('click')
    await nextTick()
    const nested = wrapper.find('[data-iris-query-group][data-depth="1"]')
    await nested.find('[data-iris-query-combinator]').setValue('or')
    await nested.find('[data-iris-query-add-rule]').trigger('click')
    await nextTick()
    await nested.find('[data-iris-query-column]').setValue('age')
    await nested.find('[data-iris-query-operator]').setValue('gte')
    await nested.find('[data-iris-query-value]').setValue('21')
    await nextTick()

    expect(builder.toQuery().children[0]).toMatchObject({
      type: 'group',
      combinator: 'or',
      children: [{ key: 'age', operator: 'gte', value: 21 }],
    })
    expect(onQueryChange).toHaveBeenLastCalledWith(builder.toQuery())

    await nested.find('[data-iris-query-remove-group]').trigger('click')
    await nextTick()
    expect(wrapper.findAll('[data-iris-query-group]')).toHaveLength(1)
    wrapper.unmount()
  })

  it('wires typed validation errors to accessible controls', async () => {
    const builder = createFilterBuilder({ columns })
    const wrapper = mount(IrisQueryBuilder, { props: { builder } })
    await wrapper.find('[data-iris-query-add]').trigger('click')
    await nextTick()

    const input = wrapper.find('[data-iris-query-value]')
    expect(input.attributes('aria-invalid')).toBe('true')
    const errorId = input.attributes('aria-describedby')
    expect(wrapper.find(`#${errorId}`).attributes('role')).toBe('alert')
    expect(wrapper.find('fieldset > legend').text()).toBe('Filters')
    expect(wrapper.find('[data-iris-query-remove]').attributes('type')).toBe('button')
    wrapper.unmount()
  })

  it('renders a nested query through Vue SSR', async () => {
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
    const html = await renderToString(
      createSSRApp({ render: () => h(IrisQueryBuilder, { builder }) }),
    )
    expect(html).toContain('data-iris-query-builder')
    expect(html).toContain('data-depth="1"')
    expect(html).toContain('data-node-id="rule"')
  })
})
