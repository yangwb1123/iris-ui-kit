import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import BadgeHarness from './badge/BadgeHarness.svelte'
import IrisAvatar from './avatar/Avatar.svelte'
import FormFieldHarness from './form-field/FormFieldHarness.svelte'
import IrisInput from './input/Input.svelte'
import IrisSwitch from './switch/Switch.svelte'

afterEach(cleanup)

describe('@iris-ui/svelte demo primitives', () => {
  it('IrisBadge reflects tone/variant + renders content', () => {
    const { getByText, container } = render(BadgeHarness, {
      props: { tone: 'success', variant: 'subtle' },
    })
    expect(getByText('new')).toBeTruthy()
    expect(container.querySelector('[data-iris-badge-tone="success"]')).not.toBeNull()
  })

  it('IrisAvatar shows initials fallback from name', () => {
    const { container } = render(IrisAvatar, { props: { name: 'Ada Lovelace' } })
    expect(
      container.querySelector('[data-iris-avatar-state="fallback"]')?.textContent?.trim(),
    ).toBe('AL')
  })

  it('IrisFormField labels + wires aria into IrisInput via context', () => {
    const { container } = render(FormFieldHarness, {
      props: { label: 'Email', hint: 'we never share it' },
    })
    const label = container.querySelector<HTMLLabelElement>('[data-iris-form-field-label]')!
    const input = container.querySelector('input')!
    expect(label.getAttribute('for')).toBe(input.getAttribute('id'))
    expect(input.getAttribute('aria-describedby')).toContain(
      container.querySelector('[data-iris-form-field-hint]')!.id,
    )
  })

  it('IrisFormField marks the control invalid + shows error', () => {
    const { container } = render(FormFieldHarness, { props: { label: 'Email', error: 'required' } })
    expect(container.querySelector('input')!.getAttribute('aria-invalid')).toBe('true')
    expect(container.querySelector('[data-iris-form-field-error]')!.textContent).toBe('required')
  })

  it('IrisSwitch toggles (controlled) + fires onChange(next)', async () => {
    const onChange = vi.fn()
    const { container } = render(IrisSwitch, { props: { checked: false, onChange } })
    const input = container.querySelector('input')!
    expect(input.getAttribute('role')).toBe('switch')
    await fireEvent.click(input)
    expect(onChange).toHaveBeenCalledWith(true, expect.anything())
  })

  it('IrisInput renders a native input standalone (no field)', () => {
    const { container } = render(IrisInput, { props: { placeholder: 'name' } })
    expect(container.querySelector('input')!.getAttribute('placeholder')).toBe('name')
  })
})
