import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { describe, expect, it } from 'vitest'
import FormFieldPropsHarness from './FormFieldPropsHarness.svelte'
import FormFieldLayoutHarness from './FormFieldLayoutHarness.svelte'

function field(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-form-field]') as HTMLElement
}
function label(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-form-field-label]') as HTMLElement
}
function area(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-iris-form-field-control]')
}
function style(el: HTMLElement): string {
  return el.getAttribute('style') ?? ''
}

describe('@iris-ui-kit/svelte IrisFormField layout props', () => {
  it('keeps the default field vertical and ungrouped', () => {
    const { container } = render(FormFieldPropsHarness, { props: { label: 'Name', hint: 'Help' } })
    expect(style(field(container))).toContain('flex-direction: column')
    expect(style(field(container))).not.toContain('box-sizing')
    expect(area(container)).toBeNull()
    expect(field(container).hasAttribute('data-iris-form-field-placement')).toBe(false)
  })

  it('labelPlacement="start" renders a shrinkable row with a control column', () => {
    const { container } = render(FormFieldPropsHarness, {
      props: { label: 'Name', labelPlacement: 'start' },
    })
    const root = field(container)
    expect(style(root)).toContain('flex-direction: row')
    expect(root.getAttribute('data-iris-form-field-placement')).toBe('start')
    expect(style(root)).toContain('box-sizing: border-box')
    expect(style(root)).toContain('min-width: 0')
    expect(style(root)).toContain('align-items: flex-start')

    expect(style(label(container))).toContain('flex: 0 1 auto')
    expect(style(label(container))).toContain('overflow-wrap: anywhere')

    const control = area(container)!
    expect(style(control)).toContain('flex: 1 1 0')
    expect(style(control)).toContain('min-width: 0')
    expect(style(control)).toContain('max-width: 100%')
    expect(control.querySelector('input')).not.toBeNull()
  })

  it('groups hint under the control in a horizontal field', () => {
    const { container } = render(FormFieldPropsHarness, {
      props: { label: 'Email', labelPlacement: 'start', hint: 'Work address' },
    })
    const control = area(container)!
    const hint = control.querySelector('[data-iris-form-field-hint]') as HTMLElement
    expect(hint.textContent).toContain('Work address')
    expect(label(container).contains(hint)).toBe(false)
    expect(container.querySelector('input')!.getAttribute('aria-describedby')).toBe(hint.id)
  })

  it('groups error under the control and keeps the ARIA contract', () => {
    const { container } = render(FormFieldPropsHarness, {
      props: { label: 'Email', labelPlacement: 'start', hint: 'Work', error: 'Required' },
    })
    const control = area(container)!
    expect(control.querySelector('[data-iris-form-field-hint]')).toBeNull()
    const err = control.querySelector('[data-iris-form-field-error]') as HTMLElement
    expect(err.getAttribute('role')).toBe('alert')
    expect(label(container).contains(err)).toBe(false)
    expect(container.querySelector('input')!.getAttribute('aria-describedby')).toBe(err.id)
    expect(container.querySelector('input')!.getAttribute('aria-invalid')).toBe('true')
  })

  it('labelWidth / controlWidth accept numbers and CSS lengths', () => {
    const { container } = render(FormFieldPropsHarness, {
      props: { label: 'Name', labelPlacement: 'start', labelWidth: 140, controlWidth: '20rem' },
    })
    expect(style(label(container))).toContain('width: 140px')
    expect(style(area(container)!)).toContain('width: 20rem')
    expect(style(area(container)!)).toContain('flex: 0 1 auto')
  })

  it('fullWidth stretches the field', () => {
    const { container } = render(FormFieldPropsHarness, { props: { fullWidth: true } })
    expect(style(field(container))).toContain('width: 100%')
    expect(area(container)).not.toBeNull()
  })

  it('rejects invalid dimensions', () => {
    const { container } = render(FormFieldPropsHarness, {
      props: { label: 'Name', labelWidth: Number.NaN, controlWidth: -8, fullWidth: true },
    })
    expect(label(container).style.width).toBe('')
    expect(style(field(container))).toContain('width: 100%')
  })

  it('keeps the for/id link, required marker and no nested label', () => {
    const { container } = render(FormFieldPropsHarness, {
      props: {
        label: 'Email',
        labelPlacement: 'start',
        required: true,
        labelFor: 'mail',
        fullWidth: true,
      },
    })
    expect(label(container).getAttribute('for')).toBe('mail')
    expect(container.querySelector('input')!.id).toBe('mail')
    expect(label(container).querySelector('[data-iris-form-field-required]')?.textContent).toBe('*')
    expect(container.querySelectorAll('label label')).toHaveLength(0)
  })

  it('reacts to layout prop changes', async () => {
    const { container, rerender } = render(FormFieldLayoutHarness, {
      props: { labelPlacement: 'start', labelWidth: 100 },
    })
    expect(style(field(container))).toContain('flex-direction: row')
    expect(style(label(container))).toContain('width: 100px')

    await rerender({ labelPlacement: 'start', labelWidth: 240 })
    await tick()
    expect(style(label(container))).toContain('width: 240px')

    await rerender({ labelPlacement: 'top' })
    await tick()
    expect(style(field(container))).toContain('flex-direction: column')
    expect(area(container)).toBeNull()
    expect(container.querySelector('input')!.getAttribute('aria-describedby')).toBe(
      container.querySelector('[data-iris-form-field-hint]')!.id,
    )
  })
})
