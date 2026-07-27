import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisStepper } from './Stepper'
import { IrisStepperStep } from './StepperStep'

afterEach(() => cleanup())

function harness(props?: {
  value?: number
  defaultValue?: number
  linear?: boolean
  orientation?: 'horizontal' | 'vertical'
  onValueChange?: (n: number) => void
}) {
  return (
    <IrisStepper
      value={props?.value}
      defaultValue={props?.defaultValue}
      linear={props?.linear}
      orientation={props?.orientation}
      onValueChange={props?.onValueChange}
    >
      <IrisStepperStep title="Step 1" />
      <IrisStepperStep title="Step 2" />
      <IrisStepperStep title="Step 3" />
    </IrisStepper>
  )
}

function steps(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-stepper-step]'))
}

function triggers(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll('[data-iris-stepper-step-trigger]'),
  ) as HTMLButtonElement[]
}

describe('@iris-ui-kit/react IrisStepper', () => {
  it('renders 3 steps', async () => {
    render(harness())
    // Steps register via useEffect — wait one tick for total to settle.
    await Promise.resolve()
    expect(steps().length).toBe(3)
  })

  it('first step is active by default (defaultValue=0)', async () => {
    render(harness())
    await Promise.resolve()
    expect(steps()[0]?.getAttribute('data-iris-stepper-step-status')).toBe('active')
    expect(steps()[0]?.getAttribute('aria-current')).toBe('step')
  })

  it('completed steps before current', async () => {
    render(harness({ defaultValue: 2 }))
    await Promise.resolve()
    expect(steps()[0]?.getAttribute('data-iris-stepper-step-status')).toBe('completed')
    expect(steps()[1]?.getAttribute('data-iris-stepper-step-status')).toBe('completed')
    expect(steps()[2]?.getAttribute('data-iris-stepper-step-status')).toBe('active')
  })

  it('linear mode blocks forward navigation', async () => {
    const onChange = vi.fn()
    render(harness({ defaultValue: 0, onValueChange: onChange }))
    await Promise.resolve()
    const [, , third] = triggers()
    act(() => {
      fireEvent.click(third!)
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('linear mode allows backward navigation', async () => {
    const onChange = vi.fn()
    render(harness({ defaultValue: 2, onValueChange: onChange }))
    await Promise.resolve()
    const [first] = triggers()
    act(() => {
      fireEvent.click(first!)
    })
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('linear=false allows arbitrary navigation', async () => {
    const onChange = vi.fn()
    render(harness({ linear: false, defaultValue: 0, onValueChange: onChange }))
    await Promise.resolve()
    const [, , third] = triggers()
    act(() => {
      fireEvent.click(third!)
    })
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('controlled value drives the active step', async () => {
    const { rerender } = render(harness({ value: 0 }))
    await Promise.resolve()
    expect(steps()[0]?.getAttribute('data-iris-stepper-step-status')).toBe('active')
    rerender(harness({ value: 1 }))
    expect(steps()[1]?.getAttribute('data-iris-stepper-step-status')).toBe('active')
  })

  it('vertical orientation reflects on data attr', async () => {
    render(harness({ orientation: 'vertical' }))
    await Promise.resolve()
    expect(
      document.querySelector('[data-iris-stepper]')?.getAttribute('data-iris-stepper-orientation'),
    ).toBe('vertical')
  })

  it('forced status="error" overrides computed status', async () => {
    render(
      <IrisStepper defaultValue={1}>
        <IrisStepperStep title="One" />
        <IrisStepperStep title="Two" status="error" />
        <IrisStepperStep title="Three" />
      </IrisStepper>,
    )
    await Promise.resolve()
    expect(steps()[1]?.getAttribute('data-iris-stepper-step-status')).toBe('error')
    const indicator = document.querySelectorAll('[data-iris-stepper-indicator]')[1]
    expect(indicator?.textContent).toBe('!')
  })

  it('disabled step does not navigate', async () => {
    const onChange = vi.fn()
    render(
      <IrisStepper defaultValue={2} onValueChange={onChange}>
        <IrisStepperStep title="One" disabled />
        <IrisStepperStep title="Two" />
        <IrisStepperStep title="Three" />
      </IrisStepper>,
    )
    await Promise.resolve()
    const [first] = triggers()
    act(() => {
      fireEvent.click(first!)
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Step outside provider throws', () => {
    const e = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<IrisStepperStep title="x" />)).toThrow(/must be inside an <IrisStepper>/)
    e.mockRestore()
  })
})
