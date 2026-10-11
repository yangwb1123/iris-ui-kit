import { describe, expect, it, vi } from 'vitest'
import { createFormStore } from '../../form'
import * as drafts from '../drafts'

const settle = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}

describe('private empty-validator validation snapshots', () => {
  // Exported call-mode counts do not prove avoided internal clone allocations.
  it('keeps private validation call mode, history and flags while required copy writes run', async () => {
    const form = createFormStore({ initialValues: { items: [] as { id: number }[] } })
    const clone = vi.spyOn(drafts, 'cloneFormDraftValue')
    let wholeValueClones: number
    try {
      for (let i = 0; i < 25; i++) form.arrayInsert('items', i, { id: i })
      for (let i = 0; i < 10; i++) form.arraySwap('items', i, 24 - i)
      for (let i = 24; i >= 0; i--) form.arrayRemove('items', i)
      wholeValueClones = clone.mock.calls.filter(([value, , detach = true]) =>
        Boolean(detach && value && typeof value === 'object' && 'items' in value),
      ).length
    } finally {
      clone.mockRestore()
    }
    expect(wholeValueClones).toBe(0)
    expect(form.getState().validating.items).toBe(true)
    await settle()
    expect(form.getState().validating.items).toBe(false)
    expect(form.getState().values.items).toEqual([])
    form.undo()
    expect(form.getState().values.items).toHaveLength(1)
    form.redo()
    expect(form.getState().values.items).toEqual([])
    form.destroy()
  })

  it('preserves nested getter exceptions before publishing validation flags with a private map', async () => {
    const getter = vi.fn(() => {
      throw new Error('snapshot getter failed')
    })
    const profile = Object.defineProperty({}, 'city', { enumerable: true, get: getter })
    const form = createFormStore({ initialValues: { profile }, maxHistory: 0 })
    const states = vi.fn()
    form.subscribe(states)
    await expect(form.validateField('profile')).rejects.toThrow('snapshot getter failed')
    expect(getter).toHaveBeenCalledTimes(1)
    expect(states).not.toHaveBeenCalled()
    expect(form.getState().validating.profile).toBeUndefined()
    form.destroy()
  })

  it('reads getter-driven destruction before starting a callback-free validation', async () => {
    let reads = 0
    const profile = {
      get city() {
        reads++
        form.destroy()
        return 'kept'
      },
    }
    const form = createFormStore({ initialValues: { profile }, maxHistory: 0 })
    const states: boolean[] = []
    form.subscribe((state) => states.push(Boolean(state.validating.profile)))
    await form.validateField('profile')
    expect(reads).toBe(1)
    expect(states).not.toContain(true)
    expect(form.getState().validating.profile).toBeUndefined()
  })

  it('does not treat a caller-supplied empty map as permanently private or callback-free', async () => {
    const validators: Record<
      string,
      (value: unknown, values: { profile: { city: string } }) => string
    > = {}
    const form = createFormStore({
      initialValues: { profile: { city: 'kept' } },
      validators,
    })
    const off = form.subscribe((state) => {
      if (!state.validating.profile) return
      validators.profile = (_value, values) => {
        values.profile.city = 'validator mutation'
        return 'required'
      }
    })
    expect(await form.validateField('profile')).toBe('required')
    expect(form.getState().values.profile.city).toBe('kept')
    off()
    form.destroy()
  })

  it('always detaches form-level validation and submit callbacks even with no field validators', async () => {
    const validate = vi.fn((values: { profile: { city: string } }) => {
      values.profile.city = 'validator mutation'
      return {}
    })
    const submit = vi.fn((values: { profile: { city: string } }) => {
      values.profile.city = 'submit mutation'
    })
    const form = createFormStore({
      initialValues: { profile: { city: 'kept' } },
      validate,
      onSubmit: submit,
    })
    await form.validateForm()
    expect(form.getState().values.profile.city).toBe('kept')
    await form.handleSubmit()
    expect(submit).toHaveBeenCalledTimes(1)
    expect(form.getState().values.profile.city).toBe('kept')
    form.destroy()
  })
})
