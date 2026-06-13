import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import FormFieldPropsHarness from './FormFieldPropsHarness.svelte'

describe('@iris-ui/svelte IrisFormField', () => {
  it('renders a wrapper with data-iris-form-field', () => {
    const { container } = render(FormFieldPropsHarness, { props: { label: 'Name' } })
    expect(container.querySelector('[data-iris-form-field]')).not.toBeNull()
  })

  it('label for matches the input id (auto-generated)', () => {
    const { container } = render(FormFieldPropsHarness, { props: { label: 'Email' } })
    const label = container.querySelector('label[data-iris-form-field-label]') as HTMLLabelElement
    const input = container.querySelector('input')!
    expect(label).not.toBeNull()
    expect(input.id).toBeTruthy()
    expect(label.getAttribute('for')).toBe(input.id)
  })

  it('labelFor override pins the control id', () => {
    const { container } = render(FormFieldPropsHarness, {
      props: { label: 'X', labelFor: 'explicit-id' },
    })
    const label = container.querySelector('label[data-iris-form-field-label]') as HTMLLabelElement
    const input = container.querySelector('input')!
    expect(label.getAttribute('for')).toBe('explicit-id')
    expect(input.id).toBe('explicit-id')
  })

  it('renders hint with id and links via aria-describedby when no error', () => {
    const { container } = render(FormFieldPropsHarness, {
      props: { label: 'X', hint: 'Must be 8+ chars' },
    })
    const hint = container.querySelector('[data-iris-form-field-hint]') as HTMLDivElement
    const input = container.querySelector('input')!
    expect(hint).not.toBeNull()
    expect(hint.id).toBeTruthy()
    expect(input.getAttribute('aria-describedby')).toBe(hint.id)
  })

  it('renders error with role="alert" and links via aria-describedby', () => {
    const { container } = render(FormFieldPropsHarness, {
      props: { label: 'X', error: 'Required' },
    })
    const err = container.querySelector('[data-iris-form-field-error]') as HTMLDivElement
    const input = container.querySelector('input')!
    expect(err).not.toBeNull()
    expect(err.getAttribute('role')).toBe('alert')
    expect(input.getAttribute('aria-describedby')).toBe(err.id)
  })

  it('error hides hint and sets state="invalid"', () => {
    const { container } = render(FormFieldPropsHarness, {
      props: { label: 'X', hint: 'Hint text', error: 'Required' },
    })
    expect(container.querySelector('[data-iris-form-field-hint]')).toBeNull()
    expect(
      container.querySelector('[data-iris-form-field]')?.getAttribute('data-iris-form-field-state'),
    ).toBe('invalid')
  })

  it('error propagates aria-invalid to the wrapped input', () => {
    const { container } = render(FormFieldPropsHarness, {
      props: { label: 'X', error: 'Required' },
    })
    expect(container.querySelector('input')!.getAttribute('aria-invalid')).toBe('true')
  })

  it('required renders the asterisk indicator', () => {
    const { container } = render(FormFieldPropsHarness, { props: { label: 'X', required: true } })
    const ind = container.querySelector('[data-iris-form-field-required]')
    expect(ind?.textContent).toBe('*')
  })

  it('omits label when not provided', () => {
    const { container } = render(FormFieldPropsHarness, {})
    expect(container.querySelector('label[data-iris-form-field-label]')).toBeNull()
  })

  it('size="sm" affects label font-size', () => {
    const { container } = render(FormFieldPropsHarness, { props: { label: 'X', size: 'sm' } })
    const label = container.querySelector('label[data-iris-form-field-label]') as HTMLLabelElement
    expect(label.getAttribute('style')).toContain('font-size: 12px')
  })

  it('label color flips to danger when error present', () => {
    const { container } = render(FormFieldPropsHarness, { props: { label: 'X', error: 'bad' } })
    const label = container.querySelector('label[data-iris-form-field-label]') as HTMLLabelElement
    expect(label.getAttribute('style')).toContain('var(--iris-danger)')
  })
})
