import { afterEach, describe, expect, it } from 'vitest'
import { createSignal, type JSX } from 'solid-js'
import { cleanup, render } from '@solidjs/testing-library'
import { IrisProvider, type IrisComponentSize } from './index'
import { IrisButton } from '../primitives/button/Button'
import { IrisInput } from '../primitives/input/Input'
import { IrisNumberInput } from '../primitives/number-input/IrisNumberInput'
import { IrisTextarea } from '../primitives/textarea/IrisTextarea'
import { IrisSwitch } from '../primitives/switch/Switch'
import { IrisCheckbox } from '../primitives/checkbox/IrisCheckbox'
import { IrisRadio } from '../primitives/radio/IrisRadio'
import { IrisRadioGroup } from '../primitives/radio/IrisRadio'
import { IrisSelect } from '../primitives/select/IrisSelect'
import { IrisCombobox } from '../primitives/combobox/IrisCombobox'
import { IrisToggleGroup } from '../primitives/toggle-group/IrisToggleGroup'
import { IrisToggleGroupItem } from '../primitives/toggle-group/IrisToggleGroup'
import { IrisDatePicker } from '../primitives/date-picker/IrisDatePicker'
import { IrisMonthPicker } from '../primitives/month-picker/IrisMonthPicker'

afterEach(cleanup)

const items = [{ value: 'a', label: 'A' }]

/** Solid serializes inline style objects without spaces — normalize for asserts. */
function css(el: Element | null): string {
  if (!el) throw new Error('element not found')
  return (el.getAttribute('style') ?? '').replace(/:\s*/g, ':')
}

function sizeOf(el: Element | null): string | null {
  if (!el) throw new Error('element not found')
  const attr = Array.from(el.attributes).find((a) => a.name.endsWith('-size'))
  return attr?.value ?? null
}

describe('@iris-ui-kit/solid IrisProvider componentSize', () => {
  it('controls default to md with no provider', () => {
    const { container } = render(() => <IrisButton>x</IrisButton>)
    expect(sizeOf(container.querySelector('[data-iris-button-size]'))).toBe('md')
  })

  it('a control without an explicit size inherits the nearest provider', () => {
    const { container } = render(() => (
      <IrisProvider componentSize="lg">
        <IrisButton>x</IrisButton>
        <IrisInput />
        <IrisNumberInput />
        <IrisTextarea />
        <IrisSwitch aria-label="s" />
        <IrisCheckbox aria-label="c" />
        <IrisRadio value="a" aria-label="r" />
        <IrisSelect items={items} />
        <IrisCombobox options={[]} />
        <IrisToggleGroup>
          <IrisToggleGroupItem value="a">A</IrisToggleGroupItem>
        </IrisToggleGroup>
        <IrisDatePicker />
        <IrisMonthPicker />
      </IrisProvider>
    ))
    expect(sizeOf(container.querySelector('[data-iris-button-size]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-input-size]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-number-input-size]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-textarea-size]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-switch-size]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-checkbox-size]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-radio-size]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-select-size]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-combobox-size]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-toggle-group-size]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-date-picker-size]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-month-picker-size]'))).toBe('lg')
  })

  it('an explicit control size always overrides the provider', () => {
    const { container } = render(() => (
      <IrisProvider componentSize="lg">
        <IrisButton size="sm">x</IrisButton>
        <IrisInput size="md" />
        <IrisSwitch size="sm" aria-label="s" />
        <IrisSelect items={items} size="md" />
      </IrisProvider>
    ))
    expect(sizeOf(container.querySelector('[data-iris-button-size]'))).toBe('sm')
    expect(sizeOf(container.querySelector('[data-iris-input-size]'))).toBe('md')
    expect(sizeOf(container.querySelector('[data-iris-switch-size]'))).toBe('sm')
    expect(sizeOf(container.querySelector('[data-iris-select-size]'))).toBe('md')
  })

  it('a nested provider without componentSize inherits its parent', () => {
    const { container } = render(() => (
      <IrisProvider componentSize="sm">
        <IrisInput />
        <IrisProvider>
          <IrisButton>x</IrisButton>
          <IrisNumberInput />
        </IrisProvider>
      </IrisProvider>
    ))
    expect(sizeOf(container.querySelector('[data-iris-input-size]'))).toBe('sm')
    expect(sizeOf(container.querySelector('[data-iris-button-size]'))).toBe('sm')
    expect(sizeOf(container.querySelector('[data-iris-number-input-size]'))).toBe('sm')
  })

  it('a nested provider with its own componentSize wins for its subtree only', () => {
    const { container } = render(() => (
      <IrisProvider componentSize="sm">
        <IrisInput />
        <IrisProvider componentSize="lg">
          <IrisInput />
        </IrisProvider>
        <IrisInput />
      </IrisProvider>
    ))
    const inputs = container.querySelectorAll('[data-iris-input-size]')
    expect([...inputs].map(sizeOf)).toEqual(['sm', 'lg', 'sm'])
  })

  it('re-renders when the provider componentSize changes', () => {
    const [size, setSize] = createSignal<IrisComponentSize | undefined>('sm')
    const { container } = render(() => (
      <IrisProvider componentSize={size()}>
        <IrisInput />
      </IrisProvider>
    ))
    expect(sizeOf(container.querySelector('[data-iris-input-size]'))).toBe('sm')
    setSize('lg')
    expect(sizeOf(container.querySelector('[data-iris-input-size]'))).toBe('lg')
    setSize(undefined)
    expect(sizeOf(container.querySelector('[data-iris-input-size]'))).toBe('md')
  })

  it('reacts to a control size prop change', () => {
    const [size, setSize] = createSignal<'sm' | 'lg'>('sm')
    const { container } = render(() => <IrisInput size={size()} />)
    expect(sizeOf(container.querySelector('[data-iris-input-size]'))).toBe('sm')
    setSize('lg')
    expect(sizeOf(container.querySelector('[data-iris-input-size]'))).toBe('lg')
  })

  it('adds no wrapper element around its children', () => {
    const { container } = render(() => (
      <IrisProvider componentSize="sm">
        <div data-testid="child" />
      </IrisProvider>
    ))
    const child = container.querySelector('[data-testid="child"]')!
    expect(child.parentElement).toBe(container)
    expect(container.childElementCount).toBe(1)
  })

  it('independent application roots do not leak size into each other', () => {
    const a = render(() => (
      <IrisProvider componentSize="lg">
        <IrisInput />
      </IrisProvider>
    ))
    const b = render(() => (
      <IrisProvider componentSize="sm">
        <IrisInput />
      </IrisProvider>
    ))
    expect(sizeOf(a.container.querySelector('[data-iris-input-size]'))).toBe('lg')
    expect(sizeOf(b.container.querySelector('[data-iris-input-size]'))).toBe('sm')
  })

  it('applies the size metrics to the real control box', () => {
    const { container } = render(() => (
      <IrisProvider componentSize="lg">
        <IrisInput />
      </IrisProvider>
    ))
    const style = css(container.querySelector('[data-iris-input]'))
    expect(style).toContain('min-height:var(--iris-control-height-lg, 40px)')
    expect(style).toContain('font-size:var(--iris-font-size-lg, 16px)')
  })

  it('a radio group passes its size down to its radios', () => {
    const { container } = render(() => (
      <IrisProvider componentSize="lg">
        <IrisRadioGroup>
          <IrisRadio value="a" />
          <IrisRadio value="b" size="sm" />
        </IrisRadioGroup>
      </IrisProvider>
    ))
    const radios = container.querySelectorAll('[data-iris-radio-size]')
    expect(sizeOf(radios[0])).toBe('lg')
    expect(sizeOf(radios[1])).toBe('sm')
  })
})

describe('@iris-ui-kit/solid control width contract', () => {
  const cases: Array<{
    name: string
    host: string
    node: (props: Record<string, unknown>) => JSX.Element
  }> = [
    { name: 'IrisInput', host: '[data-iris-input]', node: (p) => <IrisInput {...p} /> },
    {
      name: 'IrisNumberInput',
      host: '[data-iris-number-input]',
      node: (p) => <IrisNumberInput {...p} />,
    },
    {
      name: 'IrisSelect',
      host: '[data-iris-select-trigger]',
      node: (p) => <IrisSelect items={items} {...p} />,
    },
    {
      name: 'IrisDatePicker',
      host: '[data-iris-date-picker-trigger]',
      node: (p) => <IrisDatePicker {...p} />,
    },
    {
      name: 'IrisMonthPicker',
      host: '[data-iris-month-picker-trigger]',
      node: (p) => <IrisMonthPicker {...p} />,
    },
  ]

  for (const { name, host, node } of cases) {
    it(`${name} supports width + fullWidth`, () => {
      const fixed = render(() => node({ width: 240 }))
      expect(css(fixed.container.querySelector(host))).toContain('width:240px')
      const wide = render(() => node({ fullWidth: true }))
      expect(css(wide.container.querySelector(host))).toContain('width:100%')
      const custom = render(() => node({ width: '20rem' }))
      expect(css(custom.container.querySelector(host))).toContain('width:20rem')
    })
  }
})

describe('@iris-ui-kit/solid NumberInput geometry contract', () => {
  it('is border-box and its min-width covers the whole control', () => {
    const { container } = render(() => <IrisNumberInput />)
    const style = css(container.querySelector('[data-iris-number-input]'))
    expect(style).toContain('box-sizing:border-box')
    expect(style).toContain('min-width:calc(96px + 2 * var(--iris-padding-md, 12px) + 2px)')
  })

  it('drops the stepper allowance when controls are hidden', () => {
    const { container } = render(() => <IrisNumberInput showControls={false} />)
    const style = css(container.querySelector('[data-iris-number-input]'))
    expect(style).toContain('min-width:calc(40px + 2 * var(--iris-padding-md, 12px) + 2px)')
  })
})

describe('@iris-ui-kit/solid Select trigger contract', () => {
  it('keeps a min-width floor and ellipsizes long labels', () => {
    const label = 'A very long selected label that must not overflow the trigger'
    const { container } = render(() => (
      <IrisSelect items={[{ value: 'a', label }]} value="a" width={200} />
    ))
    const trigger = container.querySelector('[data-iris-select-trigger]') as HTMLElement
    const style = css(trigger)
    expect(style).toContain('min-width:140px')
    expect(style).toContain('width:200px')
    const labelEl = trigger.firstElementChild as HTMLElement
    expect(labelEl.textContent).toBe(label)
    expect(css(labelEl)).toContain('text-overflow:ellipsis')
    expect(css(labelEl)).toContain('overflow:hidden')
    expect(css(labelEl)).toContain('white-space:nowrap')
  })
})

describe('@iris-ui-kit/solid accessible naming on real controls', () => {
  it('Input forwards aria-label to the native input, not the wrapper', () => {
    const { container } = render(() => <IrisInput aria-label="Full name" aria-labelledby="lbl" />)
    const input = container.querySelector('input')!
    expect(input.getAttribute('aria-label')).toBe('Full name')
    expect(input.getAttribute('aria-labelledby')).toBe('lbl')
    expect(container.querySelector('[data-iris-input]')!.getAttribute('aria-label')).toBeNull()
  })

  it('NumberInput forwards its accessible name to the native spinbutton', () => {
    const { container } = render(() => (
      <IrisNumberInput ariaLabel="Quantity" ariaLabelledby="qty-label" />
    ))
    const input = container.querySelector('input')!
    expect(input.getAttribute('role')).toBe('spinbutton')
    expect(input.getAttribute('aria-label')).toBe('Quantity')
    expect(input.getAttribute('aria-labelledby')).toBe('qty-label')
    expect(
      container.querySelector('[data-iris-number-input]')!.getAttribute('aria-label'),
    ).toBeNull()
  })

  it('Switch forwards aria-label to the native checkbox', () => {
    const { container } = render(() => <IrisSwitch aria-label="Notifications" />)
    expect(container.querySelector('input')!.getAttribute('aria-label')).toBe('Notifications')
  })
})
