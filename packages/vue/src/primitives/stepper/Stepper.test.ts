import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisStepper } from './Stepper'
import { IrisStepperStep } from './StepperStep'

function harness(opts?: {
  current?: number
  orientation?: 'horizontal' | 'vertical'
  linear?: boolean
  onChange?: (n: number) => void
  errorOn?: number
}) {
  const o = opts ?? {}
  return defineComponent({
    setup() {
      const current = ref(o.current ?? 0)
      return () =>
        h(
          IrisStepper,
          {
            modelValue: current.value,
            orientation: o.orientation,
            linear: o.linear,
            'onUpdate:modelValue': (n: number) => {
              current.value = n
              o.onChange?.(n)
            },
          },
          {
            default: () => [
              h(IrisStepperStep, { title: 'Account', description: 'Email + password' }),
              h(IrisStepperStep, {
                title: 'Profile',
                status: o.errorOn === 1 ? 'error' : undefined,
              }),
              h(IrisStepperStep, { title: 'Done' }),
            ],
          },
        )
    },
  })
}

describe('IrisStepper', () => {
  it('renders 3 steps as <li> in an <ol>', () => {
    const w = mount(harness())
    expect(w.element.tagName).toBe('OL')
    expect(w.findAll('[data-iris-stepper-step]').length).toBe(3)
  })

  it('first step is active, others are pending', () => {
    const w = mount(harness())
    const statuses = w
      .findAll('[data-iris-stepper-step]')
      .map((el) => el.attributes('data-iris-stepper-step-status'))
    expect(statuses).toEqual(['active', 'pending', 'pending'])
  })

  it('current=1 → step 0 completed, step 1 active, step 2 pending', async () => {
    const w = mount(harness({ current: 1 }))
    await nextTick()
    const statuses = w
      .findAll('[data-iris-stepper-step]')
      .map((el) => el.attributes('data-iris-stepper-step-status'))
    expect(statuses).toEqual(['completed', 'active', 'pending'])
  })

  it('clicking a completed step (linear=true) goes back to it', async () => {
    const onChange = vi.fn()
    const w = mount(harness({ current: 2, onChange }))
    const triggers = w.findAll('[data-iris-stepper-step-trigger]')
    await triggers[0]!.trigger('click')
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('clicking a future step in linear mode is blocked', async () => {
    const onChange = vi.fn()
    const w = mount(harness({ current: 0, onChange }))
    const triggers = w.findAll('[data-iris-stepper-step-trigger]')
    await triggers[2]!.trigger('click')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('linear=false allows jumping to a future step', async () => {
    const onChange = vi.fn()
    const w = mount(harness({ current: 0, linear: false, onChange }))
    const triggers = w.findAll('[data-iris-stepper-step-trigger]')
    await triggers[2]!.trigger('click')
    expect(onChange).toHaveBeenLastCalledWith(2)
  })

  it('explicit error status overrides computed status', () => {
    const w = mount(harness({ current: 0, errorOn: 1 }))
    const step1 = w.findAll('[data-iris-stepper-step]')[1]!
    expect(step1.attributes('data-iris-stepper-step-status')).toBe('error')
  })

  it('indicator shows step number for pending/active', () => {
    const w = mount(harness({ current: 0 }))
    const indicators = w.findAll('[data-iris-stepper-indicator]')
    expect(indicators[0]!.text()).toBe('1') // active
    expect(indicators[1]!.text()).toBe('2') // pending
  })

  it('completed indicators show a checkmark', async () => {
    const w = mount(harness({ current: 2 }))
    await nextTick()
    const indicator0 = w.findAll('[data-iris-stepper-indicator]')[0]!
    expect(indicator0.attributes('data-iris-stepper-status')).toBe('completed')
    expect(indicator0.text()).toBe('✓')
  })

  it('error indicator shows !', () => {
    const w = mount(harness({ errorOn: 1 }))
    const indicator1 = w.findAll('[data-iris-stepper-indicator]')[1]!
    expect(indicator1.text()).toBe('!')
  })

  it('active step has aria-current="step"', () => {
    const w = mount(harness({ current: 1 }))
    const step1 = w.findAll('[data-iris-stepper-step]')[1]!
    expect(step1.attributes('aria-current')).toBe('step')
  })

  it('non-last steps render a connector', async () => {
    const w = mount(harness())
    await nextTick()
    expect(w.findAll('[data-iris-stepper-connector]').length).toBe(2)
  })

  it('orientation="vertical" flips data attr + connectors', () => {
    const w = mount(harness({ orientation: 'vertical' }))
    expect(w.attributes('data-iris-stepper-orientation')).toBe('vertical')
    expect(w.attributes('style')).toContain('flex-direction: column')
  })

  it('clamps modelValue beyond range', async () => {
    const w = mount(harness({ current: 99 }))
    await nextTick()
    // Last step (index 2) becomes active
    const statuses = w
      .findAll('[data-iris-stepper-step]')
      .map((el) => el.attributes('data-iris-stepper-step-status'))
    expect(statuses).toEqual(['completed', 'completed', 'active'])
  })
})
