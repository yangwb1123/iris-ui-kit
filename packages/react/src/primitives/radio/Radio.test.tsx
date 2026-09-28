import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisRadio } from './Radio'
import { IrisRadioGroup } from './RadioGroup'

afterEach(() => cleanup())

function harness(opts?: {
  value?: string | null
  defaultValue?: string | null
  disabled?: boolean
  onChange?: (next: string) => void
}) {
  return (
    <IrisRadioGroup
      value={opts?.value as string}
      defaultValue={opts?.defaultValue ?? undefined}
      disabled={opts?.disabled}
      onChange={opts?.onChange}
    >
      <IrisRadio value="a">A</IrisRadio>
      <IrisRadio value="b">B</IrisRadio>
      <IrisRadio value="c" disabled>
        C
      </IrisRadio>
    </IrisRadioGroup>
  )
}

describe('@iris-ui-kit/react IrisRadioGroup + IrisRadio', () => {
  it('renders with role="radiogroup"', () => {
    const { container } = render(harness())
    expect(container.querySelector('[role=radiogroup]')).not.toBeNull()
  })

  it('renders 3 radio inputs', () => {
    const { container } = render(harness())
    expect(container.querySelectorAll('input[type=radio]').length).toBe(3)
  })

  it('selecting one emits onChange', () => {
    const onChange = vi.fn()
    const { container } = render(harness({ onChange }))
    const inputs = container.querySelectorAll('input[type=radio]')
    fireEvent.click(inputs[1]!)
    expect(onChange).toHaveBeenLastCalledWith('b')
  })

  it('controlled honors prop', () => {
    const { container } = render(harness({ value: 'b' }))
    const inputs = container.querySelectorAll('input[type=radio]') as NodeListOf<HTMLInputElement>
    expect(inputs[0]!.checked).toBe(false)
    expect(inputs[1]!.checked).toBe(true)
    expect(inputs[2]!.checked).toBe(false)
  })

  it('defaultValue selects initial (uncontrolled)', () => {
    const { container } = render(harness({ defaultValue: 'a' }))
    const inputs = container.querySelectorAll('input[type=radio]') as NodeListOf<HTMLInputElement>
    expect(inputs[0]!.checked).toBe(true)
  })

  it('disabled group blocks selection', () => {
    const onChange = vi.fn()
    const { container } = render(harness({ disabled: true, onChange }))
    fireEvent.click(container.querySelector('input[type=radio]')!)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('per-item disabled blocks that item', () => {
    const onChange = vi.fn()
    const { container } = render(harness({ onChange }))
    const inputs = container.querySelectorAll('input[type=radio]')
    fireEvent.click(inputs[2]!) // 'c' is disabled
    expect(onChange).not.toHaveBeenCalled()
  })

  it('all inputs share the same name and radio semantics', () => {
    const { container } = render(harness())
    const inputs = container.querySelectorAll('input[type=radio]') as NodeListOf<HTMLInputElement>
    const names = new Set(Array.from(inputs).map((i) => i.name))
    expect(names.size).toBe(1)
    // Native `input[type=radio]` already exposes the radio role; the other three
    // adapters rely on that, so React must not add a redundant role attribute.
    expect(Array.from(inputs).every((input) => !input.hasAttribute('role'))).toBe(true)
    expect(
      Array.from(inputs).every((input) => input.getAttribute('aria-checked') === 'false'),
    ).toBe(true)
  })

  it('works standalone in controlled mode', () => {
    const onChange = vi.fn()

    function ControlledRadio() {
      const [checked, setChecked] = React.useState(false)
      return (
        <IrisRadio
          value="x"
          checked={checked}
          onChange={(next) => {
            onChange(next)
            setChecked(next)
          }}
        >
          X
        </IrisRadio>
      )
    }

    const { container } = render(<ControlledRadio />)
    const input = container.querySelector('input[type=radio]') as HTMLInputElement
    expect(input.checked).toBe(false)
    fireEvent.click(input)
    expect(onChange).toHaveBeenCalledWith(true)
    expect(input.checked).toBe(true)
  })

  it('works standalone in uncontrolled mode with defaultChecked', () => {
    const onChange = vi.fn()
    const { container } = render(
      <IrisRadio value="x" defaultChecked={false} onChange={onChange}>
        X
      </IrisRadio>,
    )
    const input = container.querySelector('input[type=radio]') as HTMLInputElement
    expect(input.checked).toBe(false)
    fireEvent.click(input)
    expect(input.checked).toBe(true)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('disabled standalone radio does not respond', () => {
    const onChange = vi.fn()
    const { container } = render(
      <IrisRadio value="x" disabled onChange={onChange}>
        X
      </IrisRadio>,
    )
    const input = container.querySelector('input[type=radio]') as HTMLInputElement
    fireEvent.click(input)
    expect(input.checked).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
  })
})
