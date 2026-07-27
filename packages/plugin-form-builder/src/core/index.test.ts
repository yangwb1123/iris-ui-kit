import { describe, it, expect, vi } from 'vitest'
import { runPlugins } from '@iris-ui-kit/core'
import {
  arrayRowDefaults,
  createFormBuilder,
  formBuilderPlugin,
  formBuilderTokens,
  validateArrayFields,
  type FormSchema,
} from './index'

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

  describe('conditional fields (when)', () => {
    const conditional: FormSchema = {
      fields: [
        { name: 'hasAccount', type: 'checkbox' },
        { name: 'username', type: 'text', required: true, when: (v) => v.hasAccount === true },
      ],
    }

    it('visibleFields / isVisible reflect the when predicate', () => {
      const fb = createFormBuilder(conditional)
      expect(fb.visibleFields({ hasAccount: false }).map((f) => f.name)).toEqual(['hasAccount'])
      expect(fb.visibleFields({ hasAccount: true }).map((f) => f.name)).toEqual([
        'hasAccount',
        'username',
      ])
      expect(fb.isVisible(conditional.fields[1]!, { hasAccount: true })).toBe(true)
    })

    it('a hidden required field does not block submit', async () => {
      const onSubmit = vi.fn()
      const { form } = createFormBuilder(conditional, { onSubmit })
      // username is required but hidden (hasAccount false) → submit succeeds.
      await form.handleSubmit()
      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(form.getState().errors.username).toBeUndefined()
    })

    it('the required validator applies once the field becomes visible', async () => {
      const { form } = createFormBuilder(conditional)
      form.setFieldValue('hasAccount', true)
      await form.validateForm()
      expect(form.getState().errors.username).toBe('Username is required')
    })
  })
})

describe('parse / transform', () => {
  it('parse normalizes initialValues at construction', () => {
    const { form } = createFormBuilder(schema, {
      parse: (v) => ({ ...v, fullName: 'seeded' }),
    })
    expect(form.getState().values.fullName).toBe('seeded')
  })

  it('transform shapes values passed to onSubmit', async () => {
    const onSubmit = vi.fn()
    const { form } = createFormBuilder(schema, {
      onSubmit,
      transform: (v) => ({ ...v, fullName: String(v.fullName).toUpperCase() }),
    })
    form.setFieldValue('fullName', 'ada')
    await form.handleSubmit()
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'ADA' }))
  })
})

describe('dependencies (cross-field re-validation)', () => {
  it('re-validates a dependent field when the source field changes', async () => {
    const twoField: FormSchema = {
      fields: [{ name: 'password' }, { name: 'confirm', required: true }],
    }
    const { form } = createFormBuilder(twoField, {
      dependencies: { password: ['confirm'] },
    })
    // 'confirm' is required but empty. Changing 'password' should re-validate 'confirm'.
    form.setFieldValue('password', 'abc')
    await vi.waitFor(() => {
      expect(form.getState().errors.confirm).toBe('Confirm is required')
    })
  })
})

describe('recursive array validation', () => {
  const nestedSchema: FormSchema = {
    fields: [
      {
        name: 'groups',
        type: 'array',
        defaultValue: [
          { title: 'Ready', items: [{ sku: 'A' }, { sku: '' }] },
          { title: '', items: [{ sku: 'B' }] },
        ],
        fields: [
          { name: 'title', required: true },
          {
            name: 'items',
            type: 'array',
            required: true,
            fields: [{ name: 'sku', label: 'SKU', required: true }],
          },
        ],
      },
    ],
  }

  it('compiles required errors at recursively nested canonical paths', async () => {
    const { form } = createFormBuilder(nestedSchema)
    const direct = validateArrayFields(nestedSchema.fields, form.getState().values)
    expect(direct).toEqual({
      'groups[0].items[1].sku': 'SKU is required',
      'groups[1].title': 'Title is required',
    })

    await form.validateForm()
    expect(form.getState().errors['groups[0].items[1].sku']).toBe('SKU is required')
    expect(form.getState().errors['groups[1].title']).toBe('Title is required')
  })

  it('nested errors follow their row across reorder and recompile correctly', async () => {
    const { form } = createFormBuilder(nestedSchema)
    await form.validateForm()

    form.arrayMove('groups' as never, 1, 0)
    expect(form.getState().errors['groups[0].title']).toBe('Title is required')
    expect(form.getState().errors['groups[1].items[1].sku']).toBe('SKU is required')

    await form.validateForm()
    expect(form.getState().errors).toEqual({
      'groups[0].title': 'Title is required',
      'groups[1].items[1].sku': 'SKU is required',
    })
  })

  it('seeds nested array defaults recursively for newly added rows', () => {
    const groupField = nestedSchema.fields[0]!
    expect(arrayRowDefaults(groupField)).toEqual({ title: '', items: [] })
  })

  it('merges custom nested validation over generated required errors', async () => {
    const { form } = createFormBuilder(nestedSchema, {
      validate: () => ({ 'groups[0].title': 'Domain rule' }),
    })
    await form.validateForm()
    expect(form.getState().errors['groups[0].title']).toBe('Domain rule')
    expect(form.getState().errors['groups[0].items[1].sku']).toBe('SKU is required')
  })
})

describe('wizard (multi-step)', () => {
  const wizardSchema: FormSchema = {
    steps: [{ fields: ['fullName'] }, { fields: ['age', 'role'] }],
    fields: schema.fields,
    submitLabel: 'Create',
    nextStepLabel: 'Continue',
  }

  it('stepFields returns only the current step fields on step 0', () => {
    const fb = createFormBuilder(wizardSchema)
    expect(fb.stepFields(fb.form.getState()).map((f) => f.name)).toEqual(['fullName'])
  })

  it('stepFields returns step 1 fields after advancing', async () => {
    const fb = createFormBuilder(wizardSchema)
    fb.form.setFieldValue('fullName', 'Ada')
    await fb.nextStep()
    expect(fb.stepFields(fb.form.getState()).map((f) => f.name)).toEqual(['age', 'role'])
  })

  it('isLastStep is false on step 0, true on the last step', async () => {
    const fb = createFormBuilder(wizardSchema)
    expect(fb.isLastStep(fb.form.getState())).toBe(false)
    fb.form.setFieldValue('fullName', 'Ada')
    await fb.nextStep()
    expect(fb.isLastStep(fb.form.getState())).toBe(true)
  })

  it('nextStepLabel and stepCount reflect the schema', () => {
    const fb = createFormBuilder(wizardSchema)
    expect(fb.nextStepLabel).toBe('Continue')
    expect(fb.stepCount).toBe(2)
    const noSteps = createFormBuilder(schema)
    expect(noSteps.nextStepLabel).toBe('Next')
    expect(noSteps.stepCount).toBe(1)
    expect(noSteps.isLastStep(noSteps.form.getState())).toBe(true)
  })

  it('prevStep returns to step 0', async () => {
    const fb = createFormBuilder(wizardSchema)
    fb.form.setFieldValue('fullName', 'Ada')
    await fb.nextStep()
    fb.prevStep()
    expect(fb.form.getState().currentStep).toBe(0)
  })
})

describe('formBuilderPlugin', () => {
  it('registers form tokens', () => {
    const { tokens } = runPlugins([formBuilderPlugin])
    expect(tokens['--iris-form-gap']).toBe(formBuilderTokens['--iris-form-gap'])
  })
})
