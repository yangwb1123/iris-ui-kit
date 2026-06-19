import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
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

describe('IrisFormBuilder (react)', () => {
  it('renders a field control per schema entry + a submit button', () => {
    const { container, getByText } = render(<IrisFormBuilder schema={schema} />)
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
    const { container, findByText } = render(
      <IrisFormBuilder schema={schema} onSubmit={onSubmit} />,
    )
    fireEvent.submit(container.querySelector('form')!)
    expect(await findByText('Name is required')).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits values when valid', async () => {
    const onSubmit = vi.fn()
    const { container } = render(<IrisFormBuilder schema={schema} onSubmit={onSubmit} />)
    fireEvent.change(container.querySelector('[data-iris-form-field="name"] input')!, {
      target: { value: 'Ada' },
    })
    fireEvent.submit(container.querySelector('form')!)
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled())
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
    const { container, getByText, queryByText } = render(<IrisFormBuilder schema={wizard} />)
    expect(container.querySelector('[data-iris-form-field="name"]')).not.toBeNull()
    expect(container.querySelector('[data-iris-form-field="bio"]')).toBeNull()
    expect(getByText('Next')).toBeTruthy()
    expect(queryByText('Submit')).toBeNull()
    fireEvent.change(container.querySelector('[data-iris-form-field="name"] input')!, {
      target: { value: 'Ada' },
    })
    fireEvent.click(getByText('Next'))
    await vi.waitFor(() =>
      expect(container.querySelector('[data-iris-form-field="bio"]')).not.toBeNull(),
    )
    expect(container.querySelector('[data-iris-form-field="name"]')).toBeNull()
    expect(getByText('Submit')).toBeTruthy()
    expect(getByText('Previous')).toBeTruthy()
  })

  it('hides a conditional (when) field until its predicate passes', () => {
    const conditional: FormSchema = {
      fields: [
        { name: 'hasAccount', type: 'checkbox' },
        { name: 'username', type: 'text', when: (v) => v.hasAccount === true },
      ],
    }
    const { container } = render(<IrisFormBuilder schema={conditional} />)
    expect(container.querySelector('[data-iris-form-field="username"]')).toBeNull()
    fireEvent.click(container.querySelector('[data-iris-form-field="hasAccount"] input')!)
    expect(container.querySelector('[data-iris-form-field="username"]')).not.toBeNull()
  })

  // Array (repeater) field: the visible payoff of the nested-path engine. Each
  // row's sub-fields bind to `items[i].<name>`; mutations route through
  // useFieldArray so per-row state re-keys when an earlier row is removed.
  it('array field: add/remove rows and nested sub-fields re-key on remove', () => {
    const arraySchema: FormSchema = {
      fields: [
        {
          name: 'items',
          type: 'array',
          fields: [
            { name: 'sku', required: true },
            { name: 'qty', type: 'number' },
          ],
        },
      ],
    }
    const { container } = render(<IrisFormBuilder schema={arraySchema} />)

    const arrayEl = container.querySelector('[data-iris-fb-array="items"]')!
    expect(arrayEl).toBeTruthy()
    // No auto-seeded row.
    expect(arrayEl.querySelectorAll('[data-iris-fb-row]')).toHaveLength(0)

    const add = container.querySelector('[data-iris-fb-add="items"]')!
    // Add → 1 row with both sub-fields bound to nested paths.
    fireEvent.click(add)
    expect(arrayEl.querySelectorAll('[data-iris-fb-row]')).toHaveLength(1)
    const sku0 = container.querySelector(
      '[data-iris-form-field="items[0].sku"] input',
    ) as HTMLInputElement
    expect(sku0).toBeTruthy()
    expect(
      container.querySelector('[data-iris-form-field="items[0].qty"] input[type="number"]'),
    ).toBeTruthy()

    // Type into row 0's sku.
    fireEvent.change(sku0, { target: { value: 'AAA' } })
    expect(
      (container.querySelector('[data-iris-form-field="items[0].sku"] input') as HTMLInputElement)
        .value,
    ).toBe('AAA')

    // Add a second row and give it a distinct value.
    fireEvent.click(add)
    expect(arrayEl.querySelectorAll('[data-iris-fb-row]')).toHaveLength(2)
    const sku1 = container.querySelector(
      '[data-iris-form-field="items[1].sku"] input',
    ) as HTMLInputElement
    fireEvent.change(sku1, { target: { value: 'BBB' } })

    // Remove row 0 → the SECOND row's value (BBB) is now at index 0, proving the
    // nested-path re-key flowed through useFieldArray (arrayRemove).
    fireEvent.click(container.querySelectorAll('[data-iris-fb-remove]')[0]!)
    expect(arrayEl.querySelectorAll('[data-iris-fb-row]')).toHaveLength(1)
    expect(
      (container.querySelector('[data-iris-form-field="items[0].sku"] input') as HTMLInputElement)
        .value,
    ).toBe('BBB')
  })
})
