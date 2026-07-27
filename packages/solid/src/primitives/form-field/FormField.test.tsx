import { afterEach, describe, expect, it } from 'vitest'
import { createSignal } from 'solid-js'
import { cleanup, render } from '@solidjs/testing-library'
import { IrisFormField } from './FormField'
import { IrisInput } from '../input/Input'

afterEach(cleanup)

describe('@iris-ui-kit/solid IrisFormField', () => {
  it('renders a wrapper with data-iris-form-field', () => {
    const { container } = render(() => (
      <IrisFormField label="Name">
        <IrisInput />
      </IrisFormField>
    ))
    expect(container.querySelector('[data-iris-form-field]')).not.toBeNull()
  })

  it('label for matches the input id (auto-generated, via context)', () => {
    const { container } = render(() => (
      <IrisFormField label="Email">
        <IrisInput />
      </IrisFormField>
    ))
    const label = container.querySelector('label[data-iris-form-field-label]') as HTMLLabelElement
    const input = container.querySelector('input')!
    expect(label).not.toBeNull()
    expect(input.id).toBeTruthy()
    expect(label.htmlFor).toBe(input.id)
  })

  it('labelFor override pins the control id', () => {
    const { container } = render(() => (
      <IrisFormField label="X" labelFor="explicit-id">
        <IrisInput />
      </IrisFormField>
    ))
    const label = container.querySelector('label[data-iris-form-field-label]') as HTMLLabelElement
    const input = container.querySelector('input')!
    expect(label.htmlFor).toBe('explicit-id')
    expect(input.id).toBe('explicit-id')
  })

  it('renders hint with id and links via aria-describedby when no error', () => {
    const { container } = render(() => (
      <IrisFormField label="X" hint="Must be 8+ chars">
        <IrisInput />
      </IrisFormField>
    ))
    const hint = container.querySelector('[data-iris-form-field-hint]') as HTMLDivElement
    const input = container.querySelector('input')!
    expect(hint).not.toBeNull()
    expect(hint.id).toBeTruthy()
    expect(input.getAttribute('aria-describedby')).toBe(hint.id)
  })

  it('renders error with role="alert" and links via aria-describedby', () => {
    const { container } = render(() => (
      <IrisFormField label="X" error="Required">
        <IrisInput />
      </IrisFormField>
    ))
    const err = container.querySelector('[data-iris-form-field-error]') as HTMLDivElement
    const input = container.querySelector('input')!
    expect(err).not.toBeNull()
    expect(err.getAttribute('role')).toBe('alert')
    expect(input.getAttribute('aria-describedby')).toBe(err.id)
  })

  it('error hides hint and sets state="invalid"', () => {
    const { container } = render(() => (
      <IrisFormField label="X" hint="Hint text" error="Required">
        <IrisInput />
      </IrisFormField>
    ))
    expect(container.querySelector('[data-iris-form-field-hint]')).toBeNull()
    expect(
      container.querySelector('[data-iris-form-field]')?.getAttribute('data-iris-form-field-state'),
    ).toBe('invalid')
  })

  it('error propagates aria-invalid to the context-wired input', () => {
    const { container } = render(() => (
      <IrisFormField label="X" error="Required">
        <IrisInput />
      </IrisFormField>
    ))
    const input = container.querySelector('input')!
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('reactively toggles invalid state when error appears', () => {
    const [error, setError] = createSignal<string | undefined>(undefined)
    const { container } = render(() => (
      <IrisFormField label="X" error={error()}>
        <IrisInput />
      </IrisFormField>
    ))
    const input = container.querySelector('input')!
    expect(input.getAttribute('aria-invalid')).toBeNull()
    setError('Required')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(
      container.querySelector('[data-iris-form-field]')?.getAttribute('data-iris-form-field-state'),
    ).toBe('invalid')
  })

  it('required renders the asterisk indicator', () => {
    const { container } = render(() => (
      <IrisFormField label="X" required>
        <IrisInput />
      </IrisFormField>
    ))
    const ind = container.querySelector('[data-iris-form-field-required]')
    expect(ind?.textContent).toBe('*')
  })

  it('omits label when not provided', () => {
    const { container } = render(() => (
      <IrisFormField>
        <IrisInput />
      </IrisFormField>
    ))
    expect(container.querySelector('label[data-iris-form-field-label]')).toBeNull()
  })

  it('size="sm" affects label font-size', () => {
    const { container } = render(() => (
      <IrisFormField label="X" size="sm">
        <IrisInput />
      </IrisFormField>
    ))
    const label = container.querySelector('label[data-iris-form-field-label]') as HTMLLabelElement
    expect(label.style.fontSize).toBe('12px')
  })

  it('label color flips to danger when error present', () => {
    const { container } = render(() => (
      <IrisFormField label="X" error="bad">
        <IrisInput />
      </IrisFormField>
    ))
    const label = container.querySelector('label[data-iris-form-field-label]') as HTMLLabelElement
    expect(label.style.color).toBe('var(--iris-danger)')
  })
})
