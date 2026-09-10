import { describe, expect, it, vi } from 'vitest'
import { createFormStore } from '../../form'
import { createFormHistory } from '../history'
import { createStepNavigation } from '../steps'

describe('form array adversarial cases', () => {
  it('normalizes insertion indexes before remapping metadata', () => {
    const form = createFormStore<{ items: { id: string }[] }>({
      initialValues: { items: [{ id: 'a' }, { id: 'b' }] },
      validateOnChange: false,
    })
    form.setFieldError('items[0].id', 'e0')
    form.setFieldError('items[1].id', 'e1')

    form.arrayInsert('items', 1.5, { id: 'fraction' })
    expect(form.getState().values.items.map(({ id }) => id)).toEqual(['a', 'fraction', 'b'])
    expect(form.getState().errors).toEqual({
      'items[0].id': 'e0',
      'items[2].id': 'e1',
    })

    form.arrayInsert('items', Number.NaN, { id: 'nan' })
    expect(form.getState().values.items.map(({ id }) => id)).toEqual(['nan', 'a', 'fraction', 'b'])
    expect(form.getState().errors).toEqual({
      'items[1].id': 'e0',
      'items[3].id': 'e1',
    })
  })

  it('does not mutate for malformed non-integer removal, swap, or move indexes', () => {
    const form = createFormStore<{ items: string[] }>({
      initialValues: { items: ['a', 'b'] },
      validateOnChange: false,
    })
    form.setFieldError('items[0]', 'e0')
    form.setFieldError('items[1]', 'e1')
    const before = form.getState().values.items

    form.arrayRemove('items', 0.5)
    form.arrayRemove('items', Number.NaN)
    form.arrayRemove('items', Infinity)
    form.arrayRemove('items', -1)
    form.arraySwap('items', 0.5, 1)
    form.arraySwap('items', Number.NaN, 1)
    form.arraySwap('items', 0, Infinity)
    form.arrayMove('items', 0.5, 1)
    form.arrayMove('items', Number.NaN, 1)
    form.arrayMove('items', 0, Infinity)

    expect(form.getState().values.items).toEqual(before)
    expect(form.getState().errors).toEqual({ 'items[0]': 'e0', 'items[1]': 'e1' })
  })

  it('preserves sparse slots and detaches caller array items', () => {
    const sparse: string[] = []
    sparse.length = 3
    sparse[2] = 'c'
    const item = { nested: { value: 1 } }
    const form = createFormStore<{ items: ({ nested: { value: number } } | string)[] }>({
      initialValues: { items: sparse },
      validateOnChange: false,
    })

    form.arrayPush('items', item)
    item.nested.value = 2
    const result = form.getState().values.items
    expect(0 in result).toBe(false)
    expect(1 in result).toBe(false)
    expect(result[2]).toBe('c')
    expect(result[3]).toEqual({ nested: { value: 1 } })

    form.arraySwap('items', 0, 2)
    expect(0 in form.getState().values.items).toBe(true)
    expect(2 in form.getState().values.items).toBe(false)
    form.arrayMove('items', 0, 2)
    expect(0 in form.getState().values.items).toBe(false)
    expect(2 in form.getState().values.items).toBe(true)
  })

  it('keeps malformed prototype-sensitive metadata intact during rekeying', () => {
    const errors = Object.create(null) as Record<string, string>
    errors['items[0].constructor'] = 'bad'
    const form = createFormStore<{ items: string[] }>({
      initialValues: { items: ['a', 'b'] },
      validateOnChange: false,
    })
    form.setErrors(errors as never)

    form.arrayMove('items', 0, 1)

    expect(form.getState().values.items).toEqual(['b', 'a'])
    expect(form.getState().errors).toEqual({ 'items[0].constructor': 'bad' })
  })

  it('does not leave a moved validating field active', async () => {
    let resolve!: (error: string | undefined) => void
    const form = createFormStore<{ items: { id: string }[] }>({
      initialValues: { items: [{ id: 'a' }, { id: 'b' }] },
      validateOnChange: false,
      validators: {
        'items[0].id': () => new Promise<string | undefined>((r) => (resolve = r)),
      } as never,
    })

    const validation = form.validateField('items[0].id')
    expect(form.getState().validating['items[0].id']).toBe(true)
    form.arrayMove('items', 0, 1)
    expect(form.getState().validating['items[0].id']).toBe(false)
    expect(form.getState().validating['items[1].id']).toBe(false)

    resolve(undefined)
    await validation
  })
})

describe('form history adversarial cases', () => {
  it('normalizes fractional and non-finite history limits', () => {
    let value = 0
    const fractional = createFormHistory({
      max: 1.5,
      read: () => value,
      write: (next) => {
        value = next
      },
      invalidate: () => {},
    })
    fractional.save()
    value = 1
    fractional.save()
    value = 2
    fractional.save()
    expect(fractional.canUndo()).toBe(false)

    const notANumber = createFormHistory({
      max: Number.NaN,
      read: () => value,
      write: (next) => {
        value = next
      },
      invalidate: () => {},
    })
    notANumber.save()
    expect(notANumber.canUndo()).toBe(false)
  })

  it('ignores JSON.stringify failures and undefined snapshots', () => {
    let value: unknown = undefined
    const history = createFormHistory({
      max: 10,
      read: () => value,
      write: (next) => {
        value = next
      },
      invalidate: () => {},
    })
    expect(() => history.save()).not.toThrow()
    value = { ok: true }
    history.save()
    expect(history.canUndo()).toBe(false)

    const cyclic: { self?: unknown } = {}
    cyclic.self = cyclic
    value = cyclic
    expect(() => history.save()).not.toThrow()
    expect(history.canUndo()).toBe(false)
  })

  it('keeps the history boundary when a write fails', () => {
    let value = 0
    let fail = true
    const history = createFormHistory({
      max: 10,
      read: () => value,
      write: (next) => {
        if (fail) throw new Error('write failed')
        value = next
      },
      invalidate: () => {},
    })
    history.save()
    value = 1
    history.save()

    expect(() => history.undo()).toThrow('write failed')
    expect(history.canUndo()).toBe(true)
    expect(history.canRedo()).toBe(false)
    fail = false
    history.undo()
    expect(value).toBe(0)
  })
})

describe('step navigation adversarial cases', () => {
  const steps = [{ fields: ['first'] }, { fields: ['second'] }, { fields: ['third'] }] as const

  it('normalizes fractional and non-finite step indexes', () => {
    let current = 0
    const setCurrent = (index: number) => {
      current = index
    }
    const nav = createStepNavigation(
      steps,
      () => current,
      setCurrent,
      async () => [],
      () => {},
    )

    nav.goToStep(1.9)
    expect(current).toBe(1)
    nav.goToStep(Number.NaN)
    expect(current).toBe(0)
    nav.goToStep(Infinity)
    expect(current).toBe(2)
    nav.goToStep(-Infinity)
    expect(current).toBe(0)
  })

  it('does not let concurrent nextStep calls skip a step', async () => {
    let current = 0
    const resolves: Array<(errors: (string | undefined)[]) => void> = []
    const validateFields = vi.fn(
      () =>
        new Promise<(string | undefined)[]>((resolve) => {
          resolves.push(resolve)
        }),
    )
    const nav = createStepNavigation(
      steps,
      () => current,
      (index) => {
        current = index
      },
      validateFields,
      () => {},
    )

    const first = nav.nextStep()
    const second = nav.nextStep()
    resolves[0]!([undefined])
    resolves[1]!([undefined])

    expect(await first).toBe(true)
    expect(await second).toBe(false)
    expect(current).toBe(1)
  })

  it('does not advance after re-entrant navigation during touch', async () => {
    let current = 0
    const nav = createStepNavigation(
      steps,
      () => current,
      (index) => {
        current = index
      },
      async () => [undefined],
      () => nav.goToStep(2),
    )

    expect(await nav.nextStep()).toBe(false)
    expect(current).toBe(2)
  })
})
