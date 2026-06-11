import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library'
import { IrisFormBuilder } from './index'
import type { FormSchema } from '../core'

afterEach(cleanup)

const schema: FormSchema = {
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'bio', type: 'textarea' },
    { name: 'role', type: 'select', options: [{ label: 'Admin', value: 'a' }] },
    { name: 'agree', type: 'checkbox' },
  ],
  submitLabel: 'Save',
}

describe('IrisFormBuilder (solid)', () => {
  it('renders a field control per schema entry + a submit button', () => {
    const { container, getByText } = render(() => <IrisFormBuilder schema={schema} />)
    expect(container.querySelector('[data-iris-form-field="name"] input')).toBeTruthy()
    expect(container.querySelector('[data-iris-form-field="bio"] textarea')).toBeTruthy()
    expect(container.querySelector('[data-iris-form-field="role"] select')).toBeTruthy()
    expect(
      container.querySelector('[data-iris-form-field="agree"] input[type="checkbox"]'),
    ).toBeTruthy()
    expect(getByText('Save')).toBeTruthy()
  })

  it('shows a required error on submit and blocks onSubmit', async () => {
    const onSubmit = vi.fn()
    const { container, findByText } = render(() => (
      <IrisFormBuilder schema={schema} onSubmit={onSubmit} />
    ))
    fireEvent.submit(container.querySelector('form')!)
    expect(await findByText('Name is required')).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits values when valid', async () => {
    const onSubmit = vi.fn()
    const { container } = render(() => <IrisFormBuilder schema={schema} onSubmit={onSubmit} />)
    fireEvent.input(container.querySelector('[data-iris-form-field="name"] input')!, {
      target: { value: 'Ada' },
    })
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ada' }))
  })

  it('hides a conditional (when) field until its predicate passes', async () => {
    const conditional: FormSchema = {
      fields: [
        { name: 'hasAccount', type: 'checkbox' },
        { name: 'username', type: 'text', when: (v) => v.hasAccount === true },
      ],
    }
    const { container } = render(() => <IrisFormBuilder schema={conditional} />)
    expect(container.querySelector('[data-iris-form-field="username"]')).toBeNull()
    fireEvent.click(container.querySelector('[data-iris-form-field="hasAccount"] input')!)
    await waitFor(() =>
      expect(container.querySelector('[data-iris-form-field="username"]')).not.toBeNull(),
    )
  })
})
