import { afterEach, describe, expect, it } from 'vitest'
import * as React from 'react'
import { cleanup, render } from '@testing-library/react'
import { IrisProvider, type IrisComponentSize } from '../provider'
import { IrisButton } from '../primitives/button/Button'
import { IrisInput } from '../primitives/input/Input'
import { IrisNumberInput } from '../primitives/number-input/NumberInput'
import { IrisTextarea } from '../primitives/textarea/Textarea'
import { IrisSwitch } from '../primitives/switch/Switch'
import { IrisCheckbox } from '../primitives/checkbox/Checkbox'
import { IrisRadio } from '../primitives/radio/Radio'
import { IrisSelect } from '../primitives/select/Select'
import { IrisCombobox } from '../primitives/combobox/Combobox'
import { IrisToggleGroup } from '../primitives/toggle-group/ToggleGroup'
import { IrisToggleGroupItem } from '../primitives/toggle-group/ToggleGroupItem'
import { IrisDatePicker } from '../primitives/date-picker/DatePicker'
import { IrisMonthPicker } from '../primitives/month-picker/MonthPicker'

afterEach(cleanup)

/** The `data-iris-*-size` attribute every size-bearing control exposes. */
function sizeOf(el: Element | null): string | null {
  if (!el) throw new Error('element not found')
  const attr = Array.from(el.attributes).find((a) => a.name.endsWith('-size'))
  return attr?.value ?? null
}

/**
 * The real, rendered control sizes — not a probe of the context — so the
 * contract is proven end to end (provider → context → size map → DOM).
 */
function Probe({ children }: { children: React.ReactNode }): React.ReactElement {
  return <>{children}</>
}

describe('IrisProvider componentSize (React)', () => {
  it('controls default to md with no provider', () => {
    const { container } = render(<IrisButton>x</IrisButton>)
    expect(sizeOf(container.querySelector('[data-iris-button-size]'))).toBe('md')
  })

  it('a control without an explicit size inherits the nearest provider', () => {
    const { container } = render(
      <IrisProvider componentSize="lg">
        <Probe>
          <IrisButton>x</IrisButton>
          <IrisInput />
          <IrisNumberInput />
          <IrisTextarea />
          <IrisSwitch aria-label="s" />
          <IrisCheckbox aria-label="c" />
          <IrisRadio value="a" aria-label="r" />
          <IrisSelect items={[{ value: 'a', label: 'A' }]} />
          <IrisCombobox options={[]} />
          <IrisToggleGroup>
            <IrisToggleGroupItem value="a">A</IrisToggleGroupItem>
          </IrisToggleGroup>
          <IrisDatePicker />
          <IrisMonthPicker />
        </Probe>
      </IrisProvider>,
    )
    expect(sizeOf(container.querySelector('[data-iris-button-size]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-input]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-number-input]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-textarea-size]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-switch]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-checkbox]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-radio]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-select-trigger]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-combobox-size]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-toggle-group-size]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-date-picker-trigger]'))).toBe('lg')
    expect(sizeOf(container.querySelector('[data-iris-month-picker-trigger]'))).toBe('lg')
  })

  it('an explicit control size always overrides the provider', () => {
    const { container } = render(
      <IrisProvider componentSize="lg">
        <IrisButton size="sm">x</IrisButton>
        <IrisInput size="md" />
        <IrisSwitch size="sm" aria-label="s" />
        <IrisSelect size="md" items={[{ value: 'a', label: 'A' }]} />
      </IrisProvider>,
    )
    expect(sizeOf(container.querySelector('[data-iris-button-size]'))).toBe('sm')
    expect(sizeOf(container.querySelector('[data-iris-input]'))).toBe('md')
    expect(sizeOf(container.querySelector('[data-iris-switch]'))).toBe('sm')
    expect(sizeOf(container.querySelector('[data-iris-select-trigger]'))).toBe('md')
  })

  it('a nested provider without componentSize inherits its parent', () => {
    const { container } = render(
      <IrisProvider componentSize="sm">
        <IrisButton data-testid="outer" />
        <IrisProvider>
          <IrisButton data-testid="inner" />
          <IrisInput />
        </IrisProvider>
      </IrisProvider>,
    )
    const buttons = container.querySelectorAll('[data-iris-button-size]')
    expect(sizeOf(buttons[0])).toBe('sm')
    expect(sizeOf(buttons[1])).toBe('sm')
    expect(sizeOf(container.querySelector('[data-iris-input]'))).toBe('sm')
  })

  it('a nested provider with its own componentSize wins for its subtree only', () => {
    const { container } = render(
      <IrisProvider componentSize="sm">
        <IrisInput data-testid="before" />
        <IrisProvider componentSize="lg">
          <IrisInput data-testid="inner" />
        </IrisProvider>
        <IrisInput data-testid="after" />
      </IrisProvider>,
    )
    const inputs = container.querySelectorAll('[data-iris-input]')
    expect(sizeOf(inputs[0])).toBe('sm')
    expect(sizeOf(inputs[1])).toBe('lg')
    expect(sizeOf(inputs[2])).toBe('sm')
  })

  it('re-renders when the provider componentSize changes', () => {
    const { container, rerender } = render(
      <IrisProvider componentSize="sm">
        <IrisButton>x</IrisButton>
      </IrisProvider>,
    )
    expect(sizeOf(container.querySelector('[data-iris-button-size]'))).toBe('sm')
    rerender(
      <IrisProvider componentSize="lg">
        <IrisButton>x</IrisButton>
      </IrisProvider>,
    )
    expect(sizeOf(container.querySelector('[data-iris-button-size]'))).toBe('lg')
    rerender(
      <IrisProvider>
        <IrisButton>x</IrisButton>
      </IrisProvider>,
    )
    expect(sizeOf(container.querySelector('[data-iris-button-size]'))).toBe('md')
  })

  it('adds no wrapper element around its children', () => {
    const { container } = render(
      <IrisProvider componentSize="sm">
        <div data-testid="child" />
      </IrisProvider>,
    )
    const child = container.querySelector('[data-testid="child"]')!
    // The provider renders exactly its children — no extra DOM node.
    expect(child.parentElement).toBe(container)
    expect(container.childElementCount).toBe(1)
  })

  it('independent application roots do not leak size into each other', () => {
    const a = render(
      <IrisProvider componentSize="lg">
        <IrisButton>x</IrisButton>
      </IrisProvider>,
    )
    const b = render(
      <IrisProvider componentSize="sm">
        <IrisButton>x</IrisButton>
      </IrisProvider>,
    )
    expect(sizeOf(a.container.querySelector('[data-iris-button-size]'))).toBe('lg')
    expect(sizeOf(b.container.querySelector('[data-iris-button-size]'))).toBe('sm')
  })

  it('applies the size metrics to the real control box', () => {
    const { container } = render(
      <IrisProvider componentSize="lg">
        <IrisInput />
      </IrisProvider>,
    )
    const label = container.querySelector('[data-iris-input]') as HTMLElement
    expect(label.getAttribute('style')).toContain('min-height: var(--iris-control-height-lg, 40px)')
    expect(label.getAttribute('style')).toContain('font-size: var(--iris-font-size-lg, 16px)')
  })

  it('provider sizing composes with theme/skin layers', () => {
    const { container } = render(
      <IrisProvider componentSize="sm" locale="en-US">
        <IrisButton>x</IrisButton>
      </IrisProvider>,
    )
    expect(sizeOf(container.querySelector('[data-iris-button-size]'))).toBe('sm')
  })
})

describe('IrisProvider componentSize is SSR-safe (React)', () => {
  it('renders the inherited size through renderToString without a DOM', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server')
    const html = renderToStaticMarkup(
      <IrisProvider componentSize="sm">
        <IrisButton>x</IrisButton>
      </IrisProvider>,
    )
    expect(html).toContain('data-iris-button-size="sm"')
  })
})

describe('control width contract (React)', () => {
  const widths: Array<{
    name: string
    render: (props: Record<string, unknown>) => React.ReactElement
    host: string
  }> = [
    {
      name: 'IrisInput',
      render: (p) => <IrisInput {...p} />,
      host: '[data-iris-input]',
    },
    {
      name: 'IrisNumberInput',
      render: (p) => <IrisNumberInput {...p} />,
      host: '[data-iris-number-input]',
    },
    {
      name: 'IrisSelect',
      render: (p) => <IrisSelect items={[{ value: 'a', label: 'A' }]} {...p} />,
      host: '[data-iris-select-trigger]',
    },
    {
      name: 'IrisDatePicker',
      render: (p) => <IrisDatePicker {...p} />,
      host: '[data-iris-date-picker-trigger]',
    },
    {
      name: 'IrisMonthPicker',
      render: (p) => <IrisMonthPicker {...p} />,
      host: '[data-iris-month-picker-trigger]',
    },
  ]

  for (const { name, render: renderControl, host } of widths) {
    it(`${name} supports width + fullWidth`, () => {
      const { container } = render(renderControl({ width: 240 }))
      expect((container.querySelector(host) as HTMLElement).getAttribute('style')).toContain(
        'width: 240px',
      )
      const wide = render(renderControl({ fullWidth: true }))
      expect((wide.container.querySelector(host) as HTMLElement).getAttribute('style')).toContain(
        'width: 100%',
      )
      const custom = render(renderControl({ width: '20rem' }))
      expect((custom.container.querySelector(host) as HTMLElement).getAttribute('style')).toContain(
        'width: 20rem',
      )
    })
  }
})

describe('NumberInput geometry contract (React)', () => {
  it('is border-box and its min-width covers the whole control', () => {
    const { container } = render(<IrisNumberInput />)
    const host = container.querySelector('[data-iris-number-input]') as HTMLElement
    const style = host.getAttribute('style') ?? ''
    expect(style).toContain('box-sizing: border-box')
    // field (40) + 3 gaps (12) + 2 steppers (44) + 2×padding + 2 borders.
    expect(style).toContain('min-width: calc(96px + 2 * var(--iris-padding-md, 12px) + 2px)')
  })

  it('drops the stepper allowance when controls are hidden', () => {
    const { container } = render(<IrisNumberInput showControls={false} />)
    const style = container.querySelector('[data-iris-number-input]')!.getAttribute('style') ?? ''
    expect(style).toContain('min-width: calc(40px + 2 * var(--iris-padding-md, 12px) + 2px)')
  })
})

describe('Select trigger contract (React)', () => {
  it('keeps a min-width floor and ellipsizes long labels', () => {
    const longLabel = 'A very long selected label that must not overflow the trigger'
    const { container } = render(
      <IrisSelect items={[{ value: 'a', label: longLabel }]} value="a" width={200} />,
    )
    const trigger = container.querySelector('[data-iris-select-trigger]') as HTMLElement
    expect(trigger.getAttribute('style')).toContain('min-width: 140px')
    expect(trigger.getAttribute('style')).toContain('width: 200px')
    const label = trigger.firstElementChild as HTMLElement
    expect(label.textContent).toBe(longLabel)
    expect(label.getAttribute('style')).toContain('text-overflow: ellipsis')
    expect(label.getAttribute('style')).toContain('overflow: hidden')
    expect(label.getAttribute('style')).toContain('white-space: nowrap')
  })
})

describe('accessible naming on real controls (React)', () => {
  it('Input forwards aria-label to the native input, not the wrapper', () => {
    const { container } = render(<IrisInput aria-label="Full name" aria-labelledby="lbl" />)
    const input = container.querySelector('input')!
    expect(input.getAttribute('aria-label')).toBe('Full name')
    expect(input.getAttribute('aria-labelledby')).toBe('lbl')
    const host = container.querySelector('[data-iris-input]')!
    expect(host.getAttribute('aria-label')).toBeNull()
  })

  it('NumberInput forwards aria-label to the native spinbutton', () => {
    const { container } = render(<IrisNumberInput aria-label="Quantity" />)
    const input = container.querySelector('input')!
    expect(input.getAttribute('role')).toBe('spinbutton')
    expect(input.getAttribute('aria-label')).toBe('Quantity')
  })

  it('Switch forwards aria-label to the native checkbox', () => {
    const { container } = render(<IrisSwitch aria-label="Notifications" />)
    expect(container.querySelector('input')!.getAttribute('aria-label')).toBe('Notifications')
  })
})

describe('provider size typing (React)', () => {
  it('accepts only sm | md | lg', () => {
    const sizes: IrisComponentSize[] = ['sm', 'md', 'lg']
    const { container } = render(
      <>
        {sizes.map((s) => (
          <IrisProvider key={s} componentSize={s}>
            <IrisButton>x</IrisButton>
          </IrisProvider>
        ))}
      </>,
    )
    expect(container.querySelectorAll('[data-iris-button-size]')).toHaveLength(3)
  })
})
