import { describe, expect, it, vi } from 'vitest'
import { createStepNavigation } from '../../form'

describe('createStepNavigation — integration', () => {
  const makeSteps = () => [
    { id: 'personal', fields: ['name', 'email'] as const },
    { id: 'address', fields: ['street', 'city'] as const },
    { id: 'review', fields: [] as const },
  ]

  it('returns the total step count', () => {
    const nav = createStepNavigation(
      makeSteps(),
      () => 0,
      () => {},
      async () => [],
      () => {},
    )
    expect(nav.stepCount()).toBe(3)
  })

  it('returns stepCount of 1 when steps array is empty', () => {
    const nav = createStepNavigation(
      [],
      () => 0,
      () => {},
      async () => [],
      () => {},
    )
    expect(nav.stepCount()).toBe(1)
  })

  it('goToStep navigates to the given step', () => {
    const setCurrentStep = vi.fn()
    const nav = createStepNavigation(
      makeSteps(),
      () => 0,
      setCurrentStep,
      async () => [],
      () => {},
    )
    nav.goToStep(1)
    expect(setCurrentStep).toHaveBeenCalledWith(1)
  })

  it('goToStep clamps to valid range (negative → 0)', () => {
    const setCurrentStep = vi.fn()
    const nav = createStepNavigation(
      makeSteps(),
      () => 0,
      setCurrentStep,
      async () => [],
      () => {},
    )
    nav.goToStep(-5)
    expect(setCurrentStep).toHaveBeenCalledWith(0)
  })

  it('goToStep clamps to valid range (beyond max → last)', () => {
    const setCurrentStep = vi.fn()
    const nav = createStepNavigation(
      makeSteps(),
      () => 0,
      setCurrentStep,
      async () => [],
      () => {},
    )
    nav.goToStep(100)
    expect(setCurrentStep).toHaveBeenCalledWith(2)
  })

  it('prevStep decrements from current step', () => {
    const setCurrentStep = vi.fn()
    const nav = createStepNavigation(
      makeSteps(),
      () => 1,
      setCurrentStep,
      async () => [],
      () => {},
    )
    nav.prevStep()
    expect(setCurrentStep).toHaveBeenCalledWith(0)
  })

  it('prevStep does not go below 0', () => {
    const setCurrentStep = vi.fn()
    const nav = createStepNavigation(
      makeSteps(),
      () => 0,
      setCurrentStep,
      async () => [],
      () => {},
    )
    nav.prevStep()
    expect(setCurrentStep).toHaveBeenCalledWith(0)
  })

  it('nextStep validates the current step before advancing', async () => {
    const validateFields = vi.fn().mockResolvedValue([undefined, undefined])
    const setFieldsTouched = vi.fn()
    const setCurrentStep = vi.fn()
    const nav = createStepNavigation(
      makeSteps(),
      () => 0,
      setCurrentStep,
      validateFields,
      setFieldsTouched,
    )

    const result = await nav.nextStep()

    expect(result).toBe(true)
    // Should validate the fields of step 0
    expect(validateFields).toHaveBeenCalledWith(['name', 'email'])
    // Should mark those fields as touched
    expect(setFieldsTouched).toHaveBeenCalledWith(['name', 'email'])
    // Should advance to step 1
    expect(setCurrentStep).toHaveBeenCalledWith(1)
  })

  it('nextStep does not advance when validation fails', async () => {
    const validateFields = vi.fn().mockResolvedValue(['Name required', undefined])
    const setFieldsTouched = vi.fn()
    const setCurrentStep = vi.fn()
    const nav = createStepNavigation(
      makeSteps(),
      () => 0,
      setCurrentStep,
      validateFields,
      setFieldsTouched,
    )

    const result = await nav.nextStep()

    expect(result).toBe(false)
    expect(validateFields).toHaveBeenCalledWith(['name', 'email'])
    expect(setFieldsTouched).toHaveBeenCalledWith(['name', 'email'])
    // Should NOT advance
    expect(setCurrentStep).not.toHaveBeenCalled()
  })

  it('nextStep does not advance beyond the last step', async () => {
    const validateFields = vi.fn().mockResolvedValue([undefined])
    const setCurrentStep = vi.fn()
    const nav = createStepNavigation(
      makeSteps(),
      () => 2, // Already on last step
      setCurrentStep,
      validateFields,
      () => {},
    )

    const result = await nav.nextStep()

    expect(result).toBe(false)
    expect(setCurrentStep).not.toHaveBeenCalled()
  })

  it('validateStep validates only the fields of the given step', async () => {
    const validateFields = vi.fn().mockResolvedValue([undefined, undefined])
    const setFieldsTouched = vi.fn()
    const nav = createStepNavigation(
      makeSteps(),
      () => 0,
      () => {},
      validateFields,
      setFieldsTouched,
    )

    const result = await nav.validateStep(1)

    expect(result).toBe(true)
    // Should validate fields of step 1
    expect(validateFields).toHaveBeenCalledWith(['street', 'city'])
    expect(setFieldsTouched).toHaveBeenCalledWith(['street', 'city'])
  })

  it('validateStep validates the current step when no index is given', async () => {
    const validateFields = vi.fn().mockResolvedValue([undefined])
    const nav = createStepNavigation(
      makeSteps(),
      () => 1,
      () => {},
      validateFields,
      () => {},
    )

    const result = await nav.validateStep()

    expect(result).toBe(true)
    expect(validateFields).toHaveBeenCalledWith(['street', 'city'])
  })

  it('validateStep returns true for a step with no fields', async () => {
    const validateFields = vi.fn().mockResolvedValue([])
    const nav = createStepNavigation(
      makeSteps(),
      () => 2,
      () => {},
      validateFields,
      () => {},
    )

    const result = await nav.validateStep(2)

    expect(result).toBe(true)
    // Step with empty fields array: validateFields is still called
    expect(validateFields).toHaveBeenCalledWith([])
  })

  it('supports full wizard flow: next → fail → fix → next → prev → next', async () => {
    const validateFields = vi.fn()
    const setFieldsTouched = vi.fn()
    const _setCurrentStep = vi.fn()
    let current = 0
    const getCurrent = () => current
    const setCurrent = (i: number) => {
      current = i
    }

    const nav = createStepNavigation(
      makeSteps(),
      getCurrent,
      setCurrent,
      validateFields,
      setFieldsTouched,
    )

    // Step 0 → fail
    validateFields.mockResolvedValueOnce(['Name required', undefined])
    const r1 = await nav.nextStep()
    expect(r1).toBe(false)
    expect(current).toBe(0)

    // Step 0 → pass
    validateFields.mockResolvedValueOnce([undefined, undefined])
    const r2 = await nav.nextStep()
    expect(r2).toBe(true)
    expect(current).toBe(1)

    // Step 1 → go back
    nav.prevStep()
    expect(current).toBe(0)

    // Step 0 → pass again and go to 1
    validateFields.mockResolvedValueOnce([undefined, undefined])
    const r3 = await nav.nextStep()
    expect(r3).toBe(true)
    expect(current).toBe(1)
  })
})
