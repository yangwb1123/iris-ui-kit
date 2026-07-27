import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library'
import { renderHook } from '@solidjs/testing-library'
import { IrisForm } from './IrisForm'
import { useForm } from './useForm'

afterEach(cleanup)

describe('IrisForm', () => {
  it('renders without crashing', () => {
    const { result } = renderHook(() => useForm({ initialValues: { name: '' } }))
    const { container } = render(() => (
      <IrisForm form={result.form}>
        <input name="name" />
      </IrisForm>
    ))
    expect(container.querySelector('[data-iris-form]')).not.toBeNull()
  })

  it('focuses the first invalid field after a failed submit', async () => {
    const { result } = renderHook(() =>
      useForm({
        initialValues: { email: '', name: '' },
        validateOnChange: false,
        validators: {
          email: (value) => (value ? undefined : 'Email is required'),
          name: (value) => (value ? undefined : 'Name is required'),
        },
      }),
    )
    const { container } = render(() => (
      <IrisForm form={result.form}>
        <input name="email" />
        <input name="name" />
        <button type="submit">Save</button>
      </IrisForm>
    ))
    const email = container.querySelector<HTMLInputElement>('input[name="email"]')!
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(document.activeElement).toBe(email))
  })
})

describe('useForm', () => {
  it('initializes with provided values', () => {
    const { result } = renderHook(() => useForm({ initialValues: { email: 'test@example.com' } }))
    expect(result.values().email).toBe('test@example.com')
    expect(result.isSubmitting()).toBe(false)
    expect(result.isValid()).toBe(true)
  })

  it('setFieldValue updates the field', () => {
    const { result } = renderHook(() => useForm({ initialValues: { name: '' } }))
    result.setFieldValue('name', 'Alice')
    expect(result.values().name).toBe('Alice')
  })
})
