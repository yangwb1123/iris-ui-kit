import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IrisForm } from './Form'
import { useForm } from './useForm'
import { useField } from './useField'

afterEach(cleanup)

function NameField() {
  const field = useField<string>('name')
  return (
    <div>
      <input aria-label="name" {...field.inputProps} />
      {field.error ? <span role="alert">{field.error}</span> : null}
      <span data-testid="touched">{String(field.touched)}</span>
      <span data-testid="dirty">{String(field.dirty)}</span>
    </div>
  )
}

function Demo({ onSubmit }: { onSubmit?: (values: { name: string }) => void }) {
  const form = useForm({
    initialValues: { name: '' },
    validators: { name: (v) => (v ? undefined : 'Required') },
    onSubmit,
  })
  return (
    <IrisForm form={form.form}>
      <NameField />
      <span data-testid="submitting">{String(form.isSubmitting)}</span>
      <span data-testid="valid">{String(form.isValid)}</span>
      <button type="submit">Save</button>
      <button type="button" onClick={() => form.reset()}>
        Reset
      </button>
    </IrisForm>
  )
}

describe('@iris-ui/react useForm / useField', () => {
  it('renders the initial field value', () => {
    render(<Demo />)
    expect(screen.getByLabelText<HTMLInputElement>('name').value).toBe('')
  })

  it('updates the value on change and tracks dirty', () => {
    render(<Demo />)
    const input = screen.getByLabelText<HTMLInputElement>('name')
    fireEvent.change(input, { target: { value: 'ann' } })
    expect(input.value).toBe('ann')
    expect(screen.getByTestId('dirty').textContent).toBe('true')
  })

  it('validates on change and surfaces the error', async () => {
    render(<Demo />)
    const input = screen.getByLabelText<HTMLInputElement>('name')
    fireEvent.change(input, { target: { value: 'ann' } })
    fireEvent.change(input, { target: { value: '' } })
    expect((await screen.findByRole('alert')).textContent).toBe('Required')
  })

  it('marks the field touched on blur', () => {
    render(<Demo />)
    fireEvent.blur(screen.getByLabelText('name'))
    expect(screen.getByTestId('touched').textContent).toBe('true')
  })

  it('blocks submit and shows errors when invalid', async () => {
    const onSubmit = vi.fn()
    render(<Demo onSubmit={onSubmit} />)
    fireEvent.click(screen.getByText('Save'))
    expect((await screen.findByRole('alert')).textContent).toBe('Required')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with values when valid', async () => {
    const onSubmit = vi.fn()
    render(<Demo onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'ann' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'ann' }))
  })

  it('reset restores the initial value', async () => {
    render(<Demo />)
    const input = screen.getByLabelText<HTMLInputElement>('name')
    fireEvent.change(input, { target: { value: 'ann' } })
    expect(input.value).toBe('ann')
    fireEvent.click(screen.getByText('Reset'))
    await waitFor(() => expect(input.value).toBe(''))
    expect(screen.getByTestId('dirty').textContent).toBe('false')
  })

  it('useField throws outside an <IrisForm>', () => {
    const Bad = () => {
      useField('x')
      return null
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Bad />)).toThrow(/within an <IrisForm>/)
    spy.mockRestore()
  })
})

describe('@iris-ui/react useField nested path (v3 R19)', () => {
  function SkuField() {
    const sku = useField<string>('items[1].sku')
    return (
      <>
        <input aria-label="sku" {...sku.inputProps} />
        <span data-testid="error">{sku.error ?? ''}</span>
        <span data-testid="dirty">{String(sku.dirty)}</span>
      </>
    )
  }
  function NestedDemo() {
    const form = useForm<{ items: { sku: string }[] }>({
      initialValues: { items: [{ sku: '' }, { sku: '' }] },
      validateOnChange: false,
    })
    return (
      <IrisForm form={form.form}>
        <SkuField />
        <button type="button" onClick={() => form.form.setFieldError('items[1].sku', 'Bad SKU')}>
          Err
        </button>
      </IrisForm>
    )
  }

  it('binds a nested field by path: value write + error read land on the element', () => {
    render(<NestedDemo />)
    const input = screen.getByLabelText<HTMLInputElement>('sku')
    fireEvent.change(input, { target: { value: 'X1' } })
    expect(input.value).toBe('X1')
    expect(screen.getByTestId('dirty').textContent).toBe('true')
    fireEvent.click(screen.getByText('Err'))
    expect(screen.getByTestId('error').textContent).toBe('Bad SKU')
  })
})

describe('@iris-ui/react IrisForm focus-first-error', () => {
  function MultiField() {
    const email = useField<string>('email')
    const name = useField<string>('name')
    return (
      <>
        <input aria-label="email" {...email.inputProps} />
        <input aria-label="name" {...name.inputProps} />
      </>
    )
  }
  function MultiForm() {
    const form = useForm({
      initialValues: { email: '', name: '' },
      validators: {
        email: (v) => (v ? undefined : 'Required'),
        name: (v) => (v ? undefined : 'Required'),
      },
    })
    return (
      <IrisForm form={form.form}>
        <MultiField />
        <button type="submit">Save</button>
      </IrisForm>
    )
  }

  it('focuses the first errored field on invalid submit', async () => {
    render(<MultiForm />)
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('email')))
  })
})
