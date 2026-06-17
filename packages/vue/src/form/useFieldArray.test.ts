import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisForm } from './Form'
import { useForm } from './useForm'
import { useFieldArray } from './useFieldArray'
import { useField } from './useField'

/** Inner component that accesses form context (must be child of <IrisForm>). */
const FormBody = defineComponent({
  setup() {
    const arr = useFieldArray<{ name: string }>('items')
    return () =>
      h('div', null, [
        ...arr.fields.value.map((_, i) =>
          h(FieldRow, { index: i, key: i, onRemove: () => arr.remove(i) }),
        ),
        h(
          'button',
          { type: 'button', 'data-testid': 'push', onClick: () => arr.push({ name: '' }) },
          'Add',
        ),
        h('span', { 'data-testid': 'count' }, String(arr.fields.value.length)),
      ])
  },
})

const FieldRow = defineComponent({
  props: {
    index: { type: Number, required: true },
    onRemove: { type: Function, required: true },
  },
  setup(props) {
    const field = useField<string>(`items.${props.index}.name`)
    return () =>
      h('div', null, [
        h('input', {
          'aria-label': `item-${props.index}`,
          value: field.value.value,
          onInput: (e: Event) => field.setValue((e.target as HTMLInputElement).value),
        }),
        h(
          'button',
          {
            type: 'button',
            'data-testid': `remove-${props.index}`,
            onClick: props.onRemove,
          },
          'Remove',
        ),
      ])
  },
})

const Demo = defineComponent({
  setup() {
    const form = useForm({
      initialValues: { items: [{ name: 'First' }, { name: 'Second' }] },
    })
    return () => h(IrisForm, { form: form.form }, { default: () => h(FormBody) })
  },
})

describe('useFieldArray', () => {
  it('renders initial fields', () => {
    const w = mount(Demo)
    expect(w.find('[data-testid="count"]').text()).toBe('2')
  })

  it('push adds a field', async () => {
    const w = mount(Demo)
    await w.find('[data-testid="push"]').trigger('click')
    expect(w.find('[data-testid="count"]').text()).toBe('3')
  })

  it('remove deletes a field', async () => {
    const w = mount(Demo)
    await w.find('[data-testid="remove-0"]').trigger('click')
    expect(w.find('[data-testid="count"]').text()).toBe('1')
  })

  it('can type into a field array row', async () => {
    const w = mount(Demo)
    const input = w.find('input[aria-label="item-0"]')
    await input.setValue('Updated')
    expect(
      (w.find<HTMLInputElement>('input[aria-label="item-0"]').element as HTMLInputElement).value,
    ).toBe('Updated')
  })
})
