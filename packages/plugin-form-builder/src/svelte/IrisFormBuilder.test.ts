import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import IrisFormBuilder from './IrisFormBuilder.svelte'
import type { FormSchema } from '../core'

const schema: FormSchema = {
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'bio', type: 'textarea' },
    { name: 'role', type: 'select', options: [{ label: 'Admin', value: 'a' }] },
    { name: 'agree', type: 'checkbox' },
  ],
  submitLabel: 'Save',
}

describe('IrisFormBuilder (svelte)', () => {
  it('renders a field control per schema entry + a submit button', () => {
    const { container, getByText } = render(IrisFormBuilder, { props: { schema } })
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
    const { container, findByText } = render(IrisFormBuilder, { props: { schema, onSubmit } })
    await fireEvent.submit(container.querySelector('form')!)
    expect(await findByText('Name is required')).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits values when valid', async () => {
    const onSubmit = vi.fn()
    const { container } = render(IrisFormBuilder, { props: { schema, onSubmit } })
    await fireEvent.input(container.querySelector('[data-iris-form-field="name"] input')!, {
      target: { value: 'Ada' },
    })
    await fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ada' }))
  })
})
