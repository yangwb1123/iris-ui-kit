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

  it('all inputs share the same name attribute', () => {
    const { container } = render(harness())
    const inputs = container.querySelectorAll('input[type=radio]') as NodeListOf<HTMLInputElement>
    const names = new Set(Array.from(inputs).map((i) => i.name))
    expect(names.size).toBe(1)
  })

  it('throws when IrisRadio is used outside a group', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<IrisRadio value="x">X</IrisRadio>)).toThrow(
      /IrisRadio must be used inside/,
    )
    consoleError.mockRestore()
  })
})
