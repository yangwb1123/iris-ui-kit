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
