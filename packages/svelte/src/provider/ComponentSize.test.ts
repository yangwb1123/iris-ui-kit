import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/svelte'
import { IrisProvider } from './index'
import IrisInput from '../primitives/input/Input.svelte'
import IrisNumberInput from '../primitives/number-input/IrisNumberInput.svelte'
import IrisSelect from '../primitives/select/IrisSelect.svelte'
import IrisDatePicker from '../primitives/date-picker/IrisDatePicker.svelte'
import IrisMonthPicker from '../primitives/month-picker/IrisMonthPicker.svelte'
import IrisButtonHarness from '../primitives/button/ButtonAsChildHarness.svelte'
import ComponentSizeHarness from './ComponentSizeHarness.svelte'
import ComponentSizeNestedHarness from './ComponentSizeNestedHarness.svelte'
import ComponentSizeReactiveHarness from './ComponentSizeReactiveHarness.svelte'

afterEach(cleanup)

const items = [{ value: 'a', label: 'A' }]

function sizeOf(el: Element | null): string | null {
  if (!el) throw new Error('element not found')
  const attr = Array.from(el.attributes).find((a) => a.name.endsWith('-size'))
  return attr?.value ?? null
}

/** Every size-bearing control, keyed by its `data-iris-*-size` hook. */
const SIZE_HOSTS = [
  'button',
  'input',
  'number-input',
  'textarea',
  'switch',
  'checkbox',
  'radio',
  'select',
  'combobox',
  'toggle-group',
  'date-picker',
  'month-picker',
] as const

function allSizes(container: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {}
  for (const host of SIZE_HOSTS) {
    const el =
      container.querySelector(`[data-iris-${host}-size]`) ??
      container.querySelector(`[data-iris-${host}]`)
    out[host] = sizeOf(el) ?? 'missing'
  }
  return out
}

describe('@iris-ui-kit/svelte IrisProvider componentSize', () => {
  it('controls default to md with no provider', () => {
    const { container } = render(ComponentSizeHarness, { props: { noProvider: true } })
    const sizes = allSizes(container)
    for (const host of SIZE_HOSTS) expect(sizes[host]).toBe('md')
  })

  it('a control without an explicit size inherits the nearest provider', () => {
    const { container } = render(ComponentSizeHarness, { props: { componentSize: 'lg' } })
    const sizes = allSizes(container)
    for (const host of SIZE_HOSTS) expect(sizes[host]).toBe('lg')
  })

  it('an explicit control size always overrides the provider', () => {
    const { container } = render(ComponentSizeHarness, {
      props: { componentSize: 'lg', explicit: 'sm' },
    })
    const sizes = allSizes(container)
    for (const host of SIZE_HOSTS) expect(sizes[host]).toBe('sm')
  })

  it('a nested provider without componentSize inherits its parent', () => {
    const { container } = render(ComponentSizeNestedHarness)
    const inputs = container.querySelectorAll('[data-testid]')
    expect(inputs).toHaveLength(3)
    expect(sizeOf(inputs[0].querySelector('[data-iris-input-size]'))).toBe('sm')
    expect(sizeOf(inputs[1].querySelector('[data-iris-input-size]'))).toBe('sm')
    expect(sizeOf(inputs[2].querySelector('[data-iris-input-size]'))).toBe('sm')
  })

  it('a nested provider with its own componentSize wins for its subtree only', () => {
    const { container } = render(ComponentSizeNestedHarness, { props: { innerSize: 'lg' } })
    const inputs = container.querySelectorAll('[data-testid]')
    expect(sizeOf(inputs[0].querySelector('[data-iris-input-size]'))).toBe('sm')
    expect(sizeOf(inputs[1].querySelector('[data-iris-input-size]'))).toBe('lg')
    expect(sizeOf(inputs[2].querySelector('[data-iris-input-size]'))).toBe('sm')
  })

  it('re-renders when the provider componentSize changes', async () => {
    const { container, getByTestId } = render(ComponentSizeReactiveHarness)
    expect(sizeOf(container.querySelector('[data-iris-input-size]'))).toBe('sm')
    await fireEvent.click(getByTestId('cycle'))
    expect(sizeOf(container.querySelector('[data-iris-input-size]'))).toBe('lg')
    await fireEvent.click(getByTestId('cycle'))
    expect(sizeOf(container.querySelector('[data-iris-input-size]'))).toBe('md')
  })

  it('adds no wrapper element around its children', () => {
    const { container } = render(IrisProvider)
    // The provider renders its children directly — no element of its own.
    expect(container.querySelector('*')).toBeNull()
  })

  it('independent application roots do not leak size into each other', () => {
    const a = render(ComponentSizeHarness, { props: { componentSize: 'lg' } })
    const b = render(ComponentSizeHarness, { props: { componentSize: 'sm' } })
    expect(allSizes(a.container).input).toBe('lg')
    expect(allSizes(b.container).input).toBe('sm')
  })

  it('applies the size metrics to the real control box', () => {
    const { container } = render(ComponentSizeHarness, { props: { componentSize: 'lg' } })
    const style = container.querySelector('[data-iris-input]')!.getAttribute('style') ?? ''
    expect(style).toContain('min-height: var(--iris-control-height-lg, 40px)')
    expect(style).toContain('font-size: var(--iris-font-size-lg, 16px)')
  })
})

describe('@iris-ui-kit/svelte control width contract', () => {
  const cases = [
    { name: 'IrisInput', host: '[data-iris-input]', component: IrisInput, extra: {} },
    {
      name: 'IrisNumberInput',
      host: '[data-iris-number-input]',
      component: IrisNumberInput,
      extra: {},
    },
    {
      name: 'IrisSelect',
      host: '[data-iris-select-trigger]',
      component: IrisSelect,
      extra: { items },
    },
    {
      name: 'IrisDatePicker',
      host: '[data-iris-date-picker-trigger]',
      component: IrisDatePicker,
      extra: {},
    },
    {
      name: 'IrisMonthPicker',
      host: '[data-iris-month-picker-trigger]',
      component: IrisMonthPicker,
      extra: {},
    },
  ] as const

  for (const { name, host, component, extra } of cases) {
    it(`${name} supports width + fullWidth`, () => {
      const fixed = render(component, { props: { ...extra, width: 240 } })
      expect(fixed.container.querySelector(host)!.getAttribute('style')).toContain('width: 240px')
      const wide = render(component, { props: { ...extra, fullWidth: true } })
      expect(wide.container.querySelector(host)!.getAttribute('style')).toContain('width: 100%')
      const custom = render(component, { props: { ...extra, width: '20rem' } })
      expect(custom.container.querySelector(host)!.getAttribute('style')).toContain('width: 20rem')
    })
  }
})

describe('@iris-ui-kit/svelte NumberInput geometry contract', () => {
  it('is border-box and its min-width covers the whole control', () => {
    const { container } = render(IrisNumberInput)
    const style = container.querySelector('[data-iris-number-input]')!.getAttribute('style') ?? ''
    expect(style).toContain('box-sizing: border-box')
    expect(style).toContain('min-width: calc(96px + 2 * var(--iris-padding-md, 12px) + 2px)')
  })

  it('drops the stepper allowance when controls are hidden', () => {
    const { container } = render(IrisNumberInput, { props: { showControls: false } })
    const style = container.querySelector('[data-iris-number-input]')!.getAttribute('style') ?? ''
    expect(style).toContain('min-width: calc(40px + 2 * var(--iris-padding-md, 12px) + 2px)')
  })
})

describe('@iris-ui-kit/svelte accessible naming on real controls', () => {
  it('Input forwards aria-label / aria-labelledby to the native input', () => {
    const { container } = render(IrisInput, {
      props: { 'aria-label': 'Full name', 'aria-labelledby': 'lbl' } as Record<string, unknown>,
    })
    const input = container.querySelector('input')!
    expect(input.getAttribute('aria-label')).toBe('Full name')
    expect(input.getAttribute('aria-labelledby')).toBe('lbl')
    expect(container.querySelector('[data-iris-input]')!.getAttribute('aria-label')).toBeNull()
  })

  it('NumberInput exposes its accessible name on the native spinbutton', () => {
    const { container } = render(IrisNumberInput, {
      props: { ariaLabel: 'Quantity', ariaLabelledby: 'qty-label' },
    })
    const input = container.querySelector('input')!
    expect(input.getAttribute('role')).toBe('spinbutton')
    expect(input.getAttribute('aria-label')).toBe('Quantity')
    expect(input.getAttribute('aria-labelledby')).toBe('qty-label')
  })
})

describe('@iris-ui-kit/svelte Select trigger contract', () => {
  it('keeps a min-width floor and ellipsizes long labels', () => {
    const label = 'A very long selected label that must not overflow the trigger'
    const { container } = render(IrisSelect, {
      props: { items: [{ value: 'a', label }], value: 'a', width: 200 },
    })
    const trigger = container.querySelector('[data-iris-select-trigger]') as HTMLElement
    const style = trigger.getAttribute('style') ?? ''
    expect(style).toContain('min-width: 140px')
    expect(style).toContain('width: 200px')
    const labelEl = trigger.firstElementChild as HTMLElement
    expect(labelEl.textContent?.trim()).toBe(label)
    expect(labelEl.getAttribute('style')).toContain('text-overflow: ellipsis')
    expect(labelEl.getAttribute('style')).toContain('overflow: hidden')
  })
})

describe('@iris-ui-kit/svelte IrisButton keeps its as-child contract', () => {
  it('renders a single child without a wrapper', () => {
    const { container } = render(IrisButtonHarness)
    expect(container.querySelector('[data-iris-button-size]')).not.toBeNull()
  })
})
