import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import type { FormStore } from '@iris-ui/core'
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

  // Headline nested-array payoff: a row's per-element error FOLLOWS the row when
  // earlier rows are removed/reordered, because the hook routes through the core
  // arrayRemove/arrayMove helpers (which re-key error/touched/dirty), not a raw
  // setFieldValue. Discriminating: with the old direct-set impl the error would
  // stay stranded on items[2].name.
  it('per-row error follows the row across remove + move (core re-key)', async () => {
    let store!: FormStore<{ items: { name: string }[] }>
    let remove!: (i: number) => void
    let move!: (from: number, to: number) => void

    const Capture = defineComponent({
      setup() {
        const arr = useFieldArray<{ name: string }>('items')
        remove = arr.remove
        move = arr.move
        return () => null
      },
    })
    const Harness = defineComponent({
      setup() {
        const form = useForm({
          initialValues: { items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] },
        })
        store = form.form as unknown as FormStore<{ items: { name: string }[] }>
        return () => h(IrisForm, { form: form.form }, { default: () => h(Capture) })
      },
    })
    mount(Harness)

    // Error on the LAST row (index 2). Errors are keyed by canonical path
    // (numeric indices use bracket form, e.g. `items[2].name`).
    store.setFieldError('items[2].name' as never, 'too long')
    await nextTick()
    expect(store.getState().errors['items[2].name']).toBe('too long')

    // Remove the FIRST row → error rides row 2 down to row 1.
    remove(0)
    await nextTick()
    expect(store.getState().errors['items[1].name']).toBe('too long')
    expect(store.getState().errors['items[2].name']).toBeUndefined()

    // Move row 1 → row 0 → error rides along to row 0.
    move(1, 0)
    await nextTick()
    expect(store.getState().errors['items[0].name']).toBe('too long')
    expect(store.getState().errors['items[1].name']).toBeUndefined()
  })
})
