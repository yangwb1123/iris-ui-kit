import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
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
