import { afterEach, describe, expect, it } from 'vitest'
import { createSignal } from 'solid-js'
import { cleanup, render } from '@solidjs/testing-library'
import { IrisFormField } from './FormField'
import { IrisInput } from '../input/Input'

afterEach(cleanup)

function field(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-form-field]') as HTMLElement
}
function label(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-form-field-label]') as HTMLElement
}
function area(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-iris-form-field-control]')
}

describe('@iris-ui-kit/solid IrisFormField layout props', () => {
  it('keeps the default field vertical and ungrouped', () => {
    const { container } = render(() => (
      <IrisFormField label="Name" hint="Help">
        <IrisInput />
      </IrisFormField>
    ))
    expect(field(container).style.flexDirection).toBe('column')
    expect(field(container).style.boxSizing).toBe('')
    expect(field(container).hasAttribute('data-iris-form-field-placement')).toBe(false)
    expect(area(container)).toBeNull()
  })

  it('labelPlacement="start" renders a shrinkable row with a control column', () => {
    const { container } = render(() => (
      <IrisFormField label="Name" labelPlacement="start">
        <IrisInput />
      </IrisFormField>
    ))
    const root = field(container)
    expect(root.style.flexDirection).toBe('row')
    expect(root.getAttribute('data-iris-form-field-placement')).toBe('start')
    expect(root.style.boxSizing).toBe('border-box')
    expect(root.style.minWidth).toBe('0')
    expect(root.style.alignItems).toBe('flex-start')

    expect(label(container).style.flex).toBe('0 1 auto')
    expect(label(container).style.minWidth).toBe('0')
    expect(label(container).style.overflowWrap).toBe('anywhere')

    const control = area(container)!
    expect(control.style.flex).toBe('1 1 0px')
    expect(control.style.minWidth).toBe('0')
    expect(control.style.maxWidth).toBe('100%')
    expect(control.querySelector('input')).not.toBeNull()
  })

  it('groups hint/error under the control in a horizontal field', () => {
    const { container } = render(() => (
      <IrisFormField label="Email" labelPlacement="start" hint="Work" error="Required">
        <IrisInput />
      </IrisFormField>
    ))
    const control = area(container)!
    expect(control.querySelector('[data-iris-form-field-hint]')).toBeNull()
    const err = control.querySelector('[data-iris-form-field-error]') as HTMLElement
    expect(err.getAttribute('role')).toBe('alert')
    expect(label(container).contains(err)).toBe(false)
    const input = container.querySelector('input')!
    expect(input.getAttribute('aria-describedby')).toBe(err.id)
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('labelWidth / controlWidth accept numbers and CSS lengths', () => {
    const { container } = render(() => (
      <IrisFormField label="Name" labelPlacement="start" labelWidth={140} controlWidth="20rem">
        <IrisInput />
      </IrisFormField>
    ))
    expect(label(container).style.width).toBe('140px')
    expect(area(container)!.style.width).toBe('20rem')
    expect(area(container)!.style.flex).toBe('0 1 auto')
  })

  it('fullWidth stretches the field and its control column', () => {
    const { container } = render(() => (
      <IrisFormField label="Name" fullWidth>
        <IrisInput />
      </IrisFormField>
    ))
    expect(field(container).style.width).toBe('100%')
    expect(area(container)!.style.maxWidth).toBe('100%')
  })

  it('rejects invalid dimensions', () => {
    const { container } = render(() => (
      <IrisFormField label="Name" labelWidth={Number.NaN} controlWidth={-8} fullWidth>
        <IrisInput />
      </IrisFormField>
    ))
    expect(label(container).style.width).toBe('')
    expect(area(container)!.style.width).toBe('')
    expect(field(container).style.width).toBe('100%')
  })

  it('keeps the for/id link, required marker and no nested label in a horizontal field', () => {
    const { container } = render(() => (
      <IrisFormField label="Email" labelPlacement="start" required labelFor="mail">
        <IrisInput />
      </IrisFormField>
    ))
    const lbl = label(container) as HTMLLabelElement
    expect(lbl.htmlFor).toBe('mail')
    expect(container.querySelector('input')!.id).toBe('mail')
    expect(lbl.querySelector('[data-iris-form-field-required]')?.textContent).toBe('*')
    expect(container.querySelectorAll('label label')).toHaveLength(0)
  })

  it('reacts to layout prop changes', () => {
    const [placement, setPlacement] = createSignal<'top' | 'start'>('start')
    const [width, setWidth] = createSignal(100)
    const { container } = render(() => (
      <IrisFormField label="Name" labelPlacement={placement()} labelWidth={width()} hint="Help">
        <IrisInput />
      </IrisFormField>
    ))
    expect(field(container).style.flexDirection).toBe('row')
    expect(label(container).style.width).toBe('100px')

    setWidth(240)
    expect(label(container).style.width).toBe('240px')

    setPlacement('top')
    expect(field(container).style.flexDirection).toBe('column')
    expect(area(container)).toBeNull()
    expect(container.querySelector('input')!.getAttribute('aria-describedby')).toBe(
      container.querySelector('[data-iris-form-field-hint]')!.id,
    )
  })
})
