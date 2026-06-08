import { describe, it, expect, vi } from 'vitest'
import { runPlugins } from '@iris-ui/core'
import { createFormBuilder, formBuilderPlugin, formBuilderTokens, type FormSchema } from './index'

const schema: FormSchema = {
  fields: [
    { name: 'fullName', type: 'text', required: true },
    { name: 'age', type: 'number' },
    { name: 'subscribe', type: 'checkbox' },
    { name: 'role', type: 'select', options: [{ label: 'Admin', value: 'a' }] },
  ],
  submitLabel: 'Create',
}

describe('createFormBuilder', () => {
  it('compiles initial values from field types/defaults', () => {
    const { form } = createFormBuilder(schema)
    expect(form.getState().values).toEqual({ fullName: '', age: '', subscribe: false, role: '' })
  })

  it('humanizes labels from field names', () => {
    const { labelOf } = createFormBuilder(schema)
    expect(labelOf({ name: 'fullName' })).toBe('Full Name')
    expect(labelOf({ name: 'email_address' })).toBe('Email address')
    expect(labelOf({ name: 'role', label: 'Job role' })).toBe('Job role')
  })

  it('generates a required validator from the schema', async () => {
    const { form } = createFormBuilder(schema)
    await form.validateForm()
    expect(form.getState().errors.fullName).toBe('Full Name is required')
    form.setFieldValue('fullName', 'Ada')
    await form.validateForm()
    expect(form.getState().errors.fullName).toBeUndefined()
  })

  it('wires onSubmit through to the form store', async () => {
    const onSubmit = vi.fn()
    const { form } = createFormBuilder(schema, { onSubmit })
    form.setFieldValue('fullName', 'Ada')
    await form.handleSubmit()
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'Ada' }))
  })

  it('exposes fields + submitLabel', () => {
    const fb = createFormBuilder(schema)
    expect(fb.fields).toHaveLength(4)
    expect(fb.submitLabel).toBe('Create')
  })
})

describe('formBuilderPlugin', () => {
  it('registers form tokens', () => {
    const { tokens } = runPlugins([formBuilderPlugin])
    expect(tokens['--iris-form-gap']).toBe(formBuilderTokens['--iris-form-gap'])
  })
})
