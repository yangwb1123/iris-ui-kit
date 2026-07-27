import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisTimePicker } from './IrisTimePicker'

afterEach(cleanup)

function hours(container: HTMLElement): HTMLInputElement {
  return container.querySelector('[data-iris-time-picker-hours]') as HTMLInputElement
}

function minutes(container: HTMLElement): HTMLInputElement {
  return container.querySelector('[data-iris-time-picker-minutes]') as HTMLInputElement
}

function meridiem(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('[data-iris-time-picker-meridiem]') as HTMLButtonElement
}

describe('IrisTimePicker', () => {
  it('renders labelled 24-hour spinner inputs with native bounds', () => {
    const { container } = render(() => <IrisTimePicker />)
    expect(hours(container).ariaLabel).toBe('Hours')
    expect(minutes(container).ariaLabel).toBe('Minutes')
    expect(hours(container).min).toBe('0')
    expect(hours(container).max).toBe('23')
    expect(minutes(container).min).toBe('0')
    expect(minutes(container).max).toBe('59')
    expect(meridiem(container)).toBeNull()
  })

  it('zero-pads controlled hours and minutes', () => {
    const { container } = render(() => <IrisTimePicker value={{ hours: 9, minutes: 5 }} />)
    expect(hours(container).value).toBe('09')
    expect(minutes(container).value).toBe('05')
  })

  it('uses defaultValue as mutable uncontrolled state', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisTimePicker defaultValue={{ hours: 14, minutes: 25 }} onChange={onChange} />
    ))

    fireEvent.input(hours(container), { target: { value: '16' } })

    expect(onChange).toHaveBeenLastCalledWith({ hours: 16, minutes: 25 })
    expect(hours(container).value).toBe('16')
    expect(minutes(container).value).toBe('25')
  })

  it('treats a controlled null value as midnight', () => {
    const { container } = render(() => <IrisTimePicker value={null} />)
    expect(hours(container).value).toBe('00')
    expect(minutes(container).value).toBe('00')
  })

  it('emits a controlled hour edit while preserving minutes', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisTimePicker value={{ hours: 8, minutes: 42 }} onChange={onChange} />
    ))
    fireEvent.input(hours(container), { target: { value: '10' } })
    expect(onChange).toHaveBeenLastCalledWith({ hours: 10, minutes: 42 })
  })

  it('clamps 24-hour input at both boundaries', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisTimePicker value={{ hours: 8, minutes: 0 }} onChange={onChange} />
    ))
    fireEvent.input(hours(container), { target: { value: '99' } })
    expect(onChange).toHaveBeenLastCalledWith({ hours: 23, minutes: 0 })
    fireEvent.input(hours(container), { target: { value: '-5' } })
    expect(onChange).toHaveBeenLastCalledWith({ hours: 0, minutes: 0 })
  })

  it('rounds minute input to the configured step', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisTimePicker value={{ hours: 10, minutes: 0 }} minuteStep={5} onChange={onChange} />
    ))
    fireEvent.input(minutes(container), { target: { value: '13' } })
    expect(onChange).toHaveBeenLastCalledWith({ hours: 10, minutes: 15 })
    expect(minutes(container).step).toBe('5')
  })

  it('clamps a rounded minute beyond the last minute', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisTimePicker value={{ hours: 10, minutes: 0 }} minuteStep={15} onChange={onChange} />
    ))
    fireEvent.input(minutes(container), { target: { value: '58' } })
    expect(onChange).toHaveBeenLastCalledWith({ hours: 10, minutes: 59 })
  })

  it('renders midnight and afternoon correctly in 12-hour format', () => {
    const { container } = render(() => (
      <IrisTimePicker value={{ hours: 0, minutes: 7 }} format="12h" />
    ))
    expect(hours(container).value).toBe('12')
    expect(meridiem(container).textContent).toBe('AM')

    cleanup()
    const afternoon = render(() => (
      <IrisTimePicker value={{ hours: 13, minutes: 7 }} format="12h" />
    ))
    expect(hours(afternoon.container).value).toBe('01')
    expect(meridiem(afternoon.container).textContent).toBe('PM')
  })

  it('uses 1–12 bounds for the 12-hour input', () => {
    const { container } = render(() => <IrisTimePicker format="12h" />)
    expect(hours(container).min).toBe('1')
    expect(hours(container).max).toBe('12')
    expect(meridiem(container).ariaLabel).toBe('Toggle AM/PM')
  })

  it('converts 12 AM and a PM hour back to 24-hour values', () => {
    const morningChange = vi.fn()
    const morning = render(() => (
      <IrisTimePicker value={{ hours: 9, minutes: 30 }} format="12h" onChange={morningChange} />
    ))
    fireEvent.input(hours(morning.container), { target: { value: '12' } })
    expect(morningChange).toHaveBeenLastCalledWith({ hours: 0, minutes: 30 })

    cleanup()
    const afternoonChange = vi.fn()
    const afternoon = render(() => (
      <IrisTimePicker value={{ hours: 15, minutes: 30 }} format="12h" onChange={afternoonChange} />
    ))
    fireEvent.input(hours(afternoon.container), { target: { value: '1' } })
    expect(afternoonChange).toHaveBeenLastCalledWith({ hours: 13, minutes: 30 })
  })

  it('toggles AM to PM and PM to AM without changing minutes', () => {
    const amChange = vi.fn()
    const am = render(() => (
      <IrisTimePicker value={{ hours: 3, minutes: 20 }} format="12h" onChange={amChange} />
    ))
    fireEvent.click(meridiem(am.container))
    expect(amChange).toHaveBeenLastCalledWith({ hours: 15, minutes: 20 })

    cleanup()
    const pmChange = vi.fn()
    const pm = render(() => (
      <IrisTimePicker value={{ hours: 15, minutes: 20 }} format="12h" onChange={pmChange} />
    ))
    fireEvent.click(meridiem(pm.container))
    expect(pmChange).toHaveBeenLastCalledWith({ hours: 3, minutes: 20 })
  })

  it('ArrowUp/ArrowDown step the minutes by minuteStep', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisTimePicker value={{ hours: 0, minutes: 0 }} minuteStep={15} onChange={onChange} />
    ))
    fireEvent.keyDown(minutes(container), { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith({ hours: 0, minutes: 15 })
    fireEvent.keyDown(minutes(container), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith({ hours: 0, minutes: 45 })
  })

  it('wraps 24-hour stepping in both directions', () => {
    const onChange = vi.fn()
    const upper = render(() => (
      <IrisTimePicker value={{ hours: 23, minutes: 0 }} onChange={onChange} />
    ))
    fireEvent.keyDown(hours(upper.container), { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith({ hours: 0, minutes: 0 })

    cleanup()
    const lower = render(() => (
      <IrisTimePicker value={{ hours: 0, minutes: 0 }} onChange={onChange} />
    ))
    fireEvent.keyDown(hours(lower.container), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith({ hours: 23, minutes: 0 })
  })

  it('prevents the native spinner action for handled arrow keys', () => {
    const { container } = render(() => <IrisTimePicker />)
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      bubbles: true,
      cancelable: true,
    })
    hours(container).dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('ignores unrelated keyboard input', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisTimePicker onChange={onChange} />)
    fireEvent.keyDown(hours(container), { key: 'PageDown' })
    fireEvent.keyDown(minutes(container), { key: 'Home' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('forwards id and exposes invalid styling on both fields', () => {
    const { container } = render(() => <IrisTimePicker id="office-time" invalid />)
    expect(hours(container).id).toBe('office-time')
    expect(hours(container).style.border).toContain('var(--iris-danger)')
    expect(minutes(container).style.border).toContain('var(--iris-danger)')
  })

  it('disabled state disables every control and blocks changes', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisTimePicker disabled format="12h" onChange={onChange} />)
    expect(container.querySelector('[data-iris-time-picker]')?.hasAttribute('data-disabled')).toBe(
      true,
    )
    expect(hours(container).disabled).toBe(true)
    expect(minutes(container).disabled).toBe(true)
    expect(meridiem(container).disabled).toBe(true)

    fireEvent.click(meridiem(container))
    expect(onChange).not.toHaveBeenCalled()
  })
})
