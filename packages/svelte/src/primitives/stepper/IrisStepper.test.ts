import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import StepperHarness from './StepperHarness.svelte'

describe('IrisStepper', () => {
  it('renders stepper with steps', () => {
    const { container } = render(StepperHarness)
    const stepper = container.querySelector('[data-iris-stepper]')
    expect(stepper).toBeTruthy()
    const steps = container.querySelectorAll('[data-iris-stepper-step]')
    expect(steps.length).toBe(3)
  })

  it('shows first step as active', () => {
    const { container } = render(StepperHarness)
    const steps = container.querySelectorAll('[data-iris-stepper-step]')
    expect(steps[0].getAttribute('data-iris-stepper-step-status')).toBe('active')
    expect(steps[1].getAttribute('data-iris-stepper-step-status')).toBe('pending')
  })

  it('calls onchange when a previous step is clicked', async () => {
    const onchange = vi.fn()
    const { container } = render(StepperHarness, { props: { value: 2, onchange } })
    const firstStepTrigger = container.querySelectorAll(
      '[data-iris-stepper-step-trigger]',
    )[0] as HTMLButtonElement
    await fireEvent.click(firstStepTrigger)
    flushSync()
    expect(onchange).toHaveBeenCalledWith(0)
  })

  it('advances the active step on click when uncontrolled (no value bound)', async () => {
    const onchange = vi.fn()
    const { container } = render(StepperHarness, { props: { linear: false, onchange } })
    const triggers = container.querySelectorAll('[data-iris-stepper-step-trigger]')
    await fireEvent.click(triggers[2] as HTMLButtonElement)
    flushSync()
    expect(onchange).toHaveBeenCalledWith(2)
    const steps = container.querySelectorAll('[data-iris-stepper-step]')
    expect(steps[2].getAttribute('data-iris-stepper-step-status')).toBe('active')
    expect(steps[0].getAttribute('data-iris-stepper-step-status')).toBe('completed')
  })
})
