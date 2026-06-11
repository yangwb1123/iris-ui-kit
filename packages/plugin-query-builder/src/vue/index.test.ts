import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
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
})
