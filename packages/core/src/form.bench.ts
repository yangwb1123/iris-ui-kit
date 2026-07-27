import { bench, describe } from 'vitest'
import { createFormStore, type FormValues } from './form'

/**
 * Form engine throughput benchmarks. Covers the hot paths:
 * - setFieldValue keystroke simulation (the most frequent operation)
 * - multi-field submit validation
 * - array field operations (insert/remove/swap)
 * - nested path validation (deep paths)
 */

describe('form — setFieldValue @10k', () => {
  const form = createFormStore({
    initialValues: { name: '', email: '', age: 0 } as FormValues,
  })

  bench('10k sequential field updates (keystroke sim)', () => {
    for (let i = 0; i < 10_000; i++) {
      form.setFieldValue('name', `user-${i}`)
    }
  })
})

describe('form — validate @1k (10 fields)', () => {
  const form = createFormStore({
    initialValues: Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`f${i}`, '']),
    ) as FormValues,
    validators: Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`f${i}`, (v: unknown) => (v ? undefined : 'required')]),
    ),
  })

  bench('validate 10 fields × 1k iterations', async () => {
    for (let i = 0; i < 1_000; i++) {
      form.setFieldValue('f0', `val-${i}`)
    }
    await form.validateForm()
  })
})

describe('form — array insert/remove @1k', () => {
  const form = createFormStore({
    initialValues: { items: [] } as FormValues,
  })
  bench('insert + remove 1k rows', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = form as any
    for (let i = 0; i < 1_000; i++) {
      f.arrayInsert('items', i, { sku: `SKU-${i}`, qty: i })
    }
    for (let i = 999; i >= 0; i--) {
      f.arrayRemove('items', i)
    }
  })
})

describe('form — nested path validation @10k', () => {
  const form = createFormStore({
    initialValues: {
      user: { profile: { name: '', address: { city: '', zip: '' } }, tags: [] },
    } as FormValues,
    validators: {
      'user.profile.name': (v: unknown) => (v ? undefined : 'name required'),
      'user.profile.address.city': (v: unknown) => (v ? undefined : 'city required'),
      'user.profile.address.zip': (v: unknown) => (v ? undefined : 'zip required'),
    },
  })

  bench('10k nested path field updates', () => {
    for (let i = 0; i < 10_000; i++) {
      form.setFieldValue('user.profile.name', `user-${i}`)
      form.setFieldValue('user.profile.address.city', `city-${i}`)
    }
  })
})

describe('form — array item swap @1k', () => {
  const form = createFormStore({
    initialValues: {
      items: Array.from({ length: 1_000 }, (_, i) => ({ sku: `SKU-${i}`, qty: i })),
    } as FormValues,
  })

  bench('500 swaps (reorder simulation)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = form as any
    for (let i = 0; i < 500; i++) {
      f.arraySwap('items', i, 999 - i)
    }
  })
})
