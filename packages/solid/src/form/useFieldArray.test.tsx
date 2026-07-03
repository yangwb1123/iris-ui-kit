import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { For } from 'solid-js'
import type { FormStore } from '@iris-ui/core'
import { IrisForm } from './IrisForm'
import { useForm } from './useForm'
import { useFieldArray } from './useFieldArray'
import { useField } from './useField'

afterEach(cleanup)

/** Inner component that accesses form context (must be child of <IrisForm>). */
function FormBody() {
  const arr = useFieldArray<{ name: string }>('items')
  return (
    <>
      <For each={arr.fields()}>
        {(_, i) => <FieldRow index={i()} onRemove={() => arr.remove(i())} />}
      </For>
      <button type="button" onClick={() => arr.push({ name: '' })} data-testid="push">
        Add
      </button>
      <span data-testid="count">{arr.fields().length}</span>
    </>
  )
}

function FieldRow(props: { index: number; onRemove: () => void }) {
  const field = useField<string>(`items.${props.index}.name`)
  const fp = field.fieldProps() as any
  return (
    <div>
      <input aria-label={`item-${props.index}`} {...fp} />
      <button type="button" onClick={props.onRemove} data-testid={`remove-${props.index}`}>
        Remove
      </button>
    </div>
  )
}

function Demo() {
  const form = useForm({
    initialValues: { items: [{ name: 'First' }, { name: 'Second' }] },
  })
  return (
    <IrisForm form={form.form}>
      <FormBody />
    </IrisForm>
  )
}

describe('useFieldArray', () => {
  it('renders initial fields', () => {
    render(() => <Demo />)
    expect(screen.getByTestId('count').textContent).toBe('2')
  })

  it('push adds a field', () => {
    render(() => <Demo />)
    fireEvent.click(screen.getByTestId('push'))
    expect(screen.getByTestId('count').textContent).toBe('3')
  })

  it('remove deletes a field', () => {
    render(() => <Demo />)
    fireEvent.click(screen.getByTestId('remove-0'))
    expect(screen.getByTestId('count').textContent).toBe('1')
  })

  // Headline nested-array payoff: a row's per-element error FOLLOWS the row when
  // earlier rows are removed/reordered, because the hook routes through the core
  // arrayRemove/arrayMove helpers (which re-key error/touched/dirty), not a raw
  // setFieldValue. Discriminating: with the old direct-set impl the error would
  // stay stranded on items[2].name.
  it('per-row error follows the row across remove + move (core re-key)', () => {
    let store!: FormStore<{ items: { name: string }[] }>
    let remove!: (i: number) => void
    let move!: (from: number, to: number) => void

    function Capture() {
      const arr = useFieldArray<{ name: string }>('items')
      remove = arr.remove
      move = arr.move
      return null
    }
    function Harness() {
      const form = useForm({
        initialValues: { items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] },
      })
      store = form.form as unknown as FormStore<{ items: { name: string }[] }>
      return (
        <IrisForm form={form.form}>
          <Capture />
        </IrisForm>
      )
    }
    render(() => <Harness />)

    // Errors are keyed by canonical path (numeric indices use bracket form, e.g.
    // `items[2].name`); FieldErrors only types the top-level keys, so read via a
    // string-indexable view (mirrors the `as never` cast on setFieldError).
    const errs = () => store.getState().errors as Record<string, string | undefined>

    // Error on the LAST row (index 2).
    store.setFieldError('items[2].name' as never, 'too long')
    expect(errs()['items[2].name']).toBe('too long')

    // Remove the FIRST row → error rides row 2 down to row 1.
    remove(0)
    expect(errs()['items[1].name']).toBe('too long')
    expect(errs()['items[2].name']).toBeUndefined()

    // Move row 1 → row 0 → error rides along to row 0.
    move(1, 0)
    expect(errs()['items[0].name']).toBe('too long')
    expect(errs()['items[1].name']).toBeUndefined()
  })
})
