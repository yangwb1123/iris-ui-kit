import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisBadge } from './badge'
import { IrisAvatar } from './avatar'
import { IrisFormField } from './form-field'
import { IrisInput } from './input'
import { IrisSwitch } from './switch'

afterEach(cleanup)

describe('@iris-ui-kit/solid demo primitives', () => {
  it('IrisBadge reflects tone/variant + renders content', () => {
    const { getByText, container } = render(() => (
      <IrisBadge tone="success" variant="subtle">
        new
      </IrisBadge>
    ))
    expect(getByText('new')).toBeTruthy()
    expect(container.querySelector('[data-iris-badge-tone="success"]')).not.toBeNull()
  })

  it('IrisAvatar shows initials fallback from name', () => {
    const { container } = render(() => <IrisAvatar name="Ada Lovelace" />)
    expect(container.querySelector('[data-iris-avatar-state="fallback"]')!.textContent).toBe('AL')
  })

  it('IrisFormField labels + wires aria into IrisInput via context', () => {
    const { container } = render(() => (
      <IrisFormField label="Email" hint="we never share it">
        <IrisInput />
      </IrisFormField>
    ))
    const label = container.querySelector<HTMLLabelElement>('[data-iris-form-field-label]')!
    const input = container.querySelector('input')!
    expect(label.getAttribute('for')).toBe(input.getAttribute('id'))
    expect(input.getAttribute('aria-describedby')).toContain(
      container.querySelector('[data-iris-form-field-hint]')!.id,
    )
  })

  it('IrisFormField marks the control invalid + shows error', () => {
    const { container } = render(() => (
      <IrisFormField label="Email" error="required">
        <IrisInput />
      </IrisFormField>
    ))
    expect(container.querySelector('input')!.getAttribute('aria-invalid')).toBe('true')
    expect(container.querySelector('[data-iris-form-field-error]')!.textContent).toBe('required')
  })

  it('IrisSwitch toggles (controlled) + fires onChange(next)', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisSwitch checked={false} onChange={onChange} />)
    const input = container.querySelector('input')!
    expect(input.getAttribute('role')).toBe('switch')
    fireEvent.click(input)
    expect(onChange).toHaveBeenCalledWith(true, expect.anything())
  })
})
