import { describe, expect, it, vi } from 'vitest'
import { createFormStore } from './form'

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('createFormStore — submit/validator hardening', () => {
  describe('runFieldValidator exception safety', () => {
    it('a synchronously-throwing validator does not leave validating/isValidating stuck', async () => {
      const form = createFormStore({
        initialValues: { name: '' },
        validators: {
          name: () => {
            throw new Error('boom')
          },
        },
      })
      await form.validateField('name')
      expect(form.getState().validating.name).toBe(false)
      expect(form.getState().errors.name).toBe('boom')
    })

    it('an async (rejecting) validator does not leave validating stuck', async () => {
      const form = createFormStore({
        initialValues: { name: '' },
        validators: {
          name: async () => {
            throw new Error('async boom')
          },
        },
      })
      await form.validateField('name')
      expect(form.getState().validating.name).toBe(false)
      expect(form.getState().errors.name).toBe('async boom')
    })

    it('preserves sync-validator resolution timing (one microtask)', async () => {
      const form = createFormStore({
        initialValues: { name: '' },
        validators: { name: (v) => (v ? undefined : 'Required') },
      })
      form.setFieldValue('name', '')
      // The pre-existing contract across this suite: a sync validator's result
      // is observable after exactly one microtask tick.
      await flush()
      expect(form.getState().errors.name).toBe('Required')
    })
  })

  describe('validateForm hardening', () => {
    it('clears isValidating even when config.validate throws', async () => {
      const form = createFormStore({
        initialValues: { name: '' },
        validate: async () => {
          throw new Error('whole-form boom')
        },
      })
      await expect(form.validateForm()).rejects.toThrow('whole-form boom')
      expect(form.getState().isValidating).toBe(false)
    })

    it('one throwing field validator does not block the others from reporting', async () => {
      const form = createFormStore({
        initialValues: { a: '', b: '' },
        validators: {
          a: () => {
            throw new Error('a boom')
          },
          b: (v) => (v ? undefined : 'b required'),
        },
      })
      const errors = await form.validateForm()
      expect(errors.a).toBe('a boom')
      expect(errors.b).toBe('b required')
      expect(form.getState().isValidating).toBe(false)
    })
  })

  describe('handleSubmit hardening', () => {
    it('double-submit guard: a second call while submitting is a no-op', async () => {
      let resolveSubmit!: () => void
      const onSubmit = vi.fn(() => new Promise<void>((r) => (resolveSubmit = r)))
      const form = createFormStore({ initialValues: { name: 'ok' }, onSubmit })
      const first = form.handleSubmit()
      const second = form.handleSubmit() // fired while the first is still in flight
      expect(form.getState().submitCount).toBe(1) // second call was a no-op
      // Let the first call's internal validateForm() await resolve so it
      // reaches (and calls) onSubmit before we resolve its promise.
      await flush()
      resolveSubmit()
      await Promise.all([first, second])
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it('isSubmitting resets even when validateForm throws', async () => {
      const form = createFormStore({
        initialValues: { name: '' },
        validate: async () => {
          throw new Error('boom')
        },
      })
      await expect(form.handleSubmit()).rejects.toThrow('boom')
      expect(form.getState().isSubmitting).toBe(false)
      // The double-submit guard must not be permanently stuck either.
      const onSubmit = vi.fn()
      const form2 = createFormStore({ initialValues: { name: 'x' }, onSubmit })
      await form2.handleSubmit()
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it('isSubmitting resets even when onSubmit throws', async () => {
      const onSubmit = vi.fn(async () => {
        throw new Error('submit failed')
      })
      const form = createFormStore({ initialValues: { name: 'ok' }, onSubmit })
      await expect(form.handleSubmit()).rejects.toThrow('submit failed')
      expect(form.getState().isSubmitting).toBe(false)
    })

    it('a submit blocked by validation errors still allows a later submit', async () => {
      let valid = false
      const onSubmit = vi.fn()
      const form = createFormStore({
        initialValues: { name: '' },
        validators: { name: () => (valid ? undefined : 'Required') },
        onSubmit,
      })
      await form.handleSubmit()
      expect(onSubmit).not.toHaveBeenCalled()
      expect(form.getState().isSubmitting).toBe(false)
      valid = true
      await form.handleSubmit()
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
  })

  describe('saveSnapshot circular-reference safety', () => {
    it('setFieldValue with a circular-reference value does not throw', () => {
      const circular: Record<string, unknown> = {}
      circular.self = circular
      const form = createFormStore({ initialValues: { blob: null as unknown } })
      expect(() => form.setFieldValue('blob', circular)).not.toThrow()
      expect(form.getState().values.blob).toBe(circular)
    })

    it('undo/redo still works normally around a skipped circular snapshot', () => {
      const circular: Record<string, unknown> = {}
      circular.self = circular
      const form = createFormStore({ initialValues: { blob: 'a' as unknown } })
      form.setFieldValue('blob', 'b')
      form.setFieldValue('blob', circular) // snapshot skipped, no crash
      expect(form.canUndo()).toBe(true)
      form.undo()
      expect(form.getState().values.blob).toBe('a')
    })
  })

  describe('serialize() redaction', () => {
    it('exclude drops sensitive fields from the serialized snapshot', () => {
      const form = createFormStore({
        initialValues: { email: 'a@b.com', password: 'hunter2' },
      })
      const draft = form.serialize({ exclude: ['password'] })
      expect(draft.values).toEqual({ email: 'a@b.com' })
      expect('password' in draft.values).toBe(false)
    })

    it('without exclude, all values are serialized as before', () => {
      const form = createFormStore({
        initialValues: { email: 'a@b.com', password: 'hunter2' },
      })
      const draft = form.serialize()
      expect(draft.values).toEqual({ email: 'a@b.com', password: 'hunter2' })
    })
  })
})
