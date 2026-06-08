import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisStepper, IrisStepperStep } from './IrisStepper'

afterEach(cleanup)

describe('IrisStepper', () => {
  it('renders steps', () => {
    const { container } = render(() => (
      <IrisStepper>
        <IrisStepperStep title="Step 1" />
        <IrisStepperStep title="Step 2" />
        <IrisStepperStep title="Step 3" />
      </IrisStepper>
    ))
    expect(container.querySelector('[data-iris-stepper]')).not.toBeNull()
    expect(container.querySelectorAll('[data-iris-stepper-step]').length).toBe(3)
  })

  it('marks first step as active by default', () => {
    const { container } = render(() => (
      <IrisStepper>
        <IrisStepperStep title="Step 1" />
        <IrisStepperStep title="Step 2" />
      </IrisStepper>
    ))
    const steps = container.querySelectorAll('[data-iris-stepper-step]')
    expect(steps[0].getAttribute('aria-current')).toBe('step')
    expect(steps[1].getAttribute('aria-current')).toBeNull()
  })

  it('navigates to previous step on click', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisStepper value={1} onChange={onChange}>
        <IrisStepperStep title="Step 1" />
        <IrisStepperStep title="Step 2" />
      </IrisStepper>
    ))
    const triggers = container.querySelectorAll('[data-iris-stepper-step-trigger]')
    fireEvent.click(triggers[0] as HTMLButtonElement)
    expect(onChange).toHaveBeenCalledWith(0)
  })
})
