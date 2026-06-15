import { describe, expect, it } from 'vitest'
import { standardSchemaValidator, type StandardSchemaV1 } from './standard-schema'
import { createFormStore } from './form'

/** Build a fake Standard Schema from a synchronous validator fn. */
function fakeSchema(
  validate: (
    value: unknown,
  ) =>
    | { value: unknown }
    | { issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<PropertyKey> }> },
  vendor = 'fake',
): StandardSchemaV1 {
  return { '~standard': { version: 1, vendor, validate } }
}

interface Values extends Record<string, unknown> {
  email: string
  age: number
}

describe('standardSchemaValidator', () => {
  it('returns {} when the schema reports no issues', async () => {
    const validate = standardSchemaValidator<Values>(fakeSchema((value) => ({ value })))
    expect(await validate({ email: 'a@b.com', age: 20 })).toEqual({})
  })

  it('maps issues to their top-level field', async () => {
    const schema = fakeSchema(() => ({
      issues: [
        { message: 'Invalid email', path: ['email'] },
        { message: 'Too young', path: ['age'] },
      ],
    }))
    expect(await standardSchemaValidator<Values>(schema)({ email: 'x', age: 1 })).toEqual({
      email: 'Invalid email',
      age: 'Too young',
    })
  })

  it('keeps the first issue per field', async () => {
    const schema = fakeSchema(() => ({
      issues: [
        { message: 'first', path: ['email'] },
        { message: 'second', path: ['email'] },
      ],
    }))
    expect(await standardSchemaValidator<Values>(schema)({ email: '', age: 0 })).toEqual({
      email: 'first',
    })
  })

  it('reads object-form path segments ({ key })', async () => {
    const schema: StandardSchemaV1 = {
      '~standard': {
        version: 1,
        vendor: 'fake',
        validate: () => ({ issues: [{ message: 'bad', path: [{ key: 'email' }] }] }),
      },
    }
    expect(await standardSchemaValidator<Values>(schema)({ email: '', age: 0 })).toEqual({
      email: 'bad',
    })
  })

  it('maps a NESTED issue path to its full-path key (v3 R19)', async () => {
    const schema = fakeSchema(() => ({
      issues: [
        { message: 'City required', path: ['address', 'city'] },
        { message: 'Bad SKU', path: ['items', 2, 'sku'] },
      ],
    }))
    expect(await standardSchemaValidator(schema)({})).toEqual({
      'address.city': 'City required',
      'items[2].sku': 'Bad SKU',
    })
  })

  it('handles Zod-style object segments AND numeric-string array indices', async () => {
    // Zod 3.24 emits path elements as raw keys; some adapters serialize an array
    // index as the string "2" — both must canonicalize to a bracket index.
    const schema: StandardSchemaV1 = {
      '~standard': {
        version: 1,
        vendor: 'zod',
        validate: () => ({
          issues: [{ message: 'Bad', path: [{ key: 'items' }, { key: '2' }, { key: 'sku' }] }],
        }),
      },
    }
    expect(await standardSchemaValidator(schema)({})).toEqual({ 'items[2].sku': 'Bad' })
  })

  it('a nested schema error surfaces on items[2].sku via createFormStore, not items', async () => {
    const schema = fakeSchema((value) => {
      const v = value as { items: { sku: string }[] }
      const issues = v.items
        .map((it, i) => (it.sku ? null : { message: 'SKU required', path: ['items', i, 'sku'] }))
        .filter(Boolean) as ReadonlyArray<{ message: string; path: ReadonlyArray<PropertyKey> }>
      return issues.length ? { issues } : { value }
    })
    const form = createFormStore<{ items: { sku: string }[] }>({
      initialValues: { items: [{ sku: 'ok' }, { sku: 'ok' }, { sku: '' }] },
      validate: standardSchemaValidator(schema),
    })
    const errors = await form.validateForm()
    expect(errors).toEqual({ 'items[2].sku': 'SKU required' })
    // The error lands on the element field, NOT collapsed onto the array.
    expect(form.getState().errors['items[2].sku']).toBe('SKU required')
    expect(form.getState().errors.items).toBeUndefined()
  })

  it('supports async schemas', async () => {
    const schema = fakeSchema(async () => ({ issues: [{ message: 'nope', path: ['age'] }] }))
    expect(await standardSchemaValidator<Values>(schema)({ email: '', age: 0 })).toEqual({
      age: 'nope',
    })
  })

  it('plugs into createFormStore as a form-level validate', async () => {
    const schema = fakeSchema((value) => {
      const v = value as Values
      return v.email.includes('@')
        ? { value }
        : { issues: [{ message: 'Invalid', path: ['email'] }] }
    })
    const form = createFormStore<Values>({
      initialValues: { email: 'x', age: 20 },
      validate: standardSchemaValidator<Values>(schema),
    })
    expect(await form.validateForm()).toEqual({ email: 'Invalid' })
    form.setFieldValue('email', 'a@b.com')
    expect(await form.validateForm()).toEqual({})
  })
})
