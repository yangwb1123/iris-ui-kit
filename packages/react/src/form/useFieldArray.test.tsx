import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IrisForm } from './Form'
import { useForm } from './useForm'
import { useFieldArray } from './useFieldArray'
import { useField } from './useField'

afterEach(cleanup)

/** Inner component that accesses form context (must be child of <IrisForm>). */
function FormBody() {
  const arr = useFieldArray<{ name: string }>('items')
  return (
    <>
      {arr.fields.map((f, i) => (
        <FieldRow key={f.key} index={i} onRemove={() => arr.remove(i)} />
      ))}
      <button type="button" onClick={() => arr.push({ name: '' })} data-testid="push">
        Add
      </button>
      <span data-testid="count">{arr.fields.length}</span>
    </>
  )
}

function FieldRow({ index, onRemove }: { index: number; onRemove: () => void }) {
  const field = useField<string>(`items.${index}.name`)
  return (
    <div>
      <input aria-label={`item-${index}`} {...field.inputProps} />
      <button type="button" onClick={onRemove} data-testid={`remove-${index}`}>
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
    render(<Demo />)
    expect(screen.getByTestId('count').textContent).toBe('2')
  })

  it('push adds a field', () => {
    render(<Demo />)
    fireEvent.click(screen.getByTestId('push'))
    expect(screen.getByTestId('count').textContent).toBe('3')
  })

  it('remove deletes a field', () => {
    render(<Demo />)
    fireEvent.click(screen.getByTestId('remove-0'))
    expect(screen.getByTestId('count').textContent).toBe('1')
  })
})
