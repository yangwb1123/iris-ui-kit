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

  it('wizard: renders Next/Previous and advances steps on click', async () => {
    const wizard: FormSchema = {
      steps: [{ fields: ['name'] }, { fields: ['bio'] }],
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'bio', type: 'textarea' },
      ],
    }
    const { container, getByText, queryByText } = render(IrisFormBuilder, {
      props: { schema: wizard },
    })
    expect(container.querySelector('[data-iris-form-field="name"]')).not.toBeNull()
    expect(container.querySelector('[data-iris-form-field="bio"]')).toBeNull()
    expect(getByText('Next')).toBeTruthy()
    expect(queryByText('Submit')).toBeNull()
    await fireEvent.input(container.querySelector('[data-iris-form-field="name"] input')!, {
      target: { value: 'Ada' },
    })
    await fireEvent.click(getByText('Next'))
    await waitFor(() =>
      expect(container.querySelector('[data-iris-form-field="bio"]')).not.toBeNull(),
    )
    expect(container.querySelector('[data-iris-form-field="name"]')).toBeNull()
    expect(getByText('Submit')).toBeTruthy()
    expect(getByText('Previous')).toBeTruthy()
  })

  it('hides a conditional (when) field until its predicate passes', async () => {
    const conditional: FormSchema = {
      fields: [
        { name: 'hasAccount', type: 'checkbox' },
        { name: 'username', type: 'text', when: (v) => v.hasAccount === true },
      ],
    }
    const { container } = render(IrisFormBuilder, { props: { schema: conditional } })
    expect(container.querySelector('[data-iris-form-field="username"]')).toBeNull()
    await fireEvent.click(container.querySelector('[data-iris-form-field="hasAccount"] input')!)
    await waitFor(() =>
      expect(container.querySelector('[data-iris-form-field="username"]')).not.toBeNull(),
    )
  })
})
