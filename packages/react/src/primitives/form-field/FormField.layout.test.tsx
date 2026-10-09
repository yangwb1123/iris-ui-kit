import * as React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisFormField } from './FormField'
import { IrisInput } from '../input/Input'

afterEach(() => cleanup())

function field(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-form-field]') as HTMLElement
}
function label(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-form-field-label]') as HTMLElement
}
function controlArea(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-iris-form-field-control]')
}

describe('@iris-ui-kit/react IrisFormField layout props', () => {
  it('default field keeps its original vertical, ungrouped DOM', () => {
    const { container } = render(
      <IrisFormField label="Name" hint="Help">
        <IrisInput />
      </IrisFormField>,
    )
    expect(field(container).style.flexDirection).toBe('column')
    expect(field(container).style.boxSizing).toBe('')
    expect(field(container).hasAttribute('data-iris-form-field-placement')).toBe(false)
    expect(controlArea(container)).toBeNull()
    // hint stays a direct sibling of the control, exactly as before
    expect(field(container).querySelector('[data-iris-form-field-hint]')).not.toBeNull()
  })

  it('labelPlacement="start" renders a shrinkable row with a control area', () => {
    const { container } = render(
      <IrisFormField label="Name" labelPlacement="start">
        <IrisInput />
      </IrisFormField>,
    )
    const root = field(container)
    expect(root.style.flexDirection).toBe('row')
    expect(root.getAttribute('data-iris-form-field-placement')).toBe('start')
    // box-model guarantees: the field can shrink inside its parent
    expect(root.style.boxSizing).toBe('border-box')
    expect(root.style.minWidth).toBe('0')
    expect(root.style.alignItems).toBe('flex-start')

    const lbl = label(container)
    expect(lbl.style.flex).toBe('0 1 auto')
    expect(lbl.style.minWidth).toBe('0')
    expect(lbl.style.overflowWrap).toBe('anywhere')

    const area = controlArea(container)!
    expect(area).not.toBeNull()
    expect(area.style.flex).toBe('1 1 0px')
    expect(area.style.minWidth).toBe('0')
    expect(area.style.maxWidth).toBe('100%')
    expect(area.style.boxSizing).toBe('border-box')
    expect(area.querySelector('input')).not.toBeNull()
  })

  it('groups hint/error under the control in a horizontal field', () => {
    const { container } = render(
      <IrisFormField label="Email" labelPlacement="start" hint="Work address" error="Required">
        <IrisInput />
      </IrisFormField>,
    )
    const area = controlArea(container)!
    // The error wins over the hint, as it always has.
    expect(area.querySelector('[data-iris-form-field-hint]')).toBeNull()
    const err = area.querySelector('[data-iris-form-field-error]') as HTMLElement
    expect(err.getAttribute('role')).toBe('alert')
    // …and it lives inside the control column, not beside the label.
    expect(label(container).contains(err)).toBe(false)
    expect(err.previousElementSibling?.tagName).toBe('LABEL')
  })

  it('keeps the hint in the control column when there is no error', () => {
    const { container } = render(
      <IrisFormField label="Email" labelPlacement="start" hint="Work address">
        <IrisInput />
      </IrisFormField>,
    )
    const area = controlArea(container)!
    const hint = area.querySelector('[data-iris-form-field-hint]') as HTMLElement
    expect(hint.textContent).toBe('Work address')
    expect(container.querySelector('input')!.getAttribute('aria-describedby')).toBe(hint.id)
  })

  it('labelWidth accepts a number (px) and a CSS length', () => {
    const { container: px } = render(
      <IrisFormField label="Name" labelPlacement="start" labelWidth={140}>
        <IrisInput />
      </IrisFormField>,
    )
    expect(label(px).style.width).toBe('140px')
    expect(label(px).style.flex).toBe('0 1 auto')

    const { container: rem } = render(
      <IrisFormField label="Name" labelPlacement="start" labelWidth="8rem">
        <IrisInput />
      </IrisFormField>,
    )
    expect(label(rem).style.width).toBe('8rem')
  })

  it('controlWidth sizes the control column and can shrink below it', () => {
    const { container } = render(
      <IrisFormField label="Name" labelPlacement="start" controlWidth="20rem">
        <IrisInput />
      </IrisFormField>,
    )
    const area = controlArea(container)!
    expect(area.style.width).toBe('20rem')
    expect(area.style.flex).toBe('0 1 auto')
    expect(area.style.minWidth).toBe('0')
    expect(area.style.maxWidth).toBe('100%')
  })

  it('fullWidth stretches the field and its control column', () => {
    const { container } = render(
      <IrisFormField label="Name" fullWidth>
        <IrisInput />
      </IrisFormField>,
    )
    expect(field(container).style.width).toBe('100%')
    const area = controlArea(container)!
    expect(area.style.flex).toBe('1 1 0px')
    expect(area.style.maxWidth).toBe('100%')
  })

  it('rejects invalid dimensions instead of emitting broken CSS', () => {
    const { container } = render(
      <IrisFormField label="Name" labelWidth={Number.NaN} controlWidth={-8} fullWidth>
        <IrisInput />
      </IrisFormField>,
    )
    expect(label(container).style.width).toBe('')
    expect(controlArea(container)!.style.width).toBe('')
    expect(field(container).style.width).toBe('100%')
  })

  it('keeps a real for/id link, required marker and ARIA wiring in a horizontal field', () => {
    const { container } = render(
      <IrisFormField label="Email" labelPlacement="start" required error="Bad" labelFor="mail">
        <IrisInput />
      </IrisFormField>,
    )
    const lbl = label(container) as HTMLLabelElement
    const input = container.querySelector('input')!
    expect(lbl.htmlFor).toBe('mail')
    expect(input.id).toBe('mail')
    expect(lbl.querySelector('[data-iris-form-field-required]')?.textContent).toBe('*')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const err = container.querySelector('[data-iris-form-field-error]') as HTMLElement
    expect(input.getAttribute('aria-describedby')).toBe(err.id)
    // never nests a label around the control's own label wrapper
    expect(container.querySelectorAll('label label')).toHaveLength(0)
  })

  it('reacts to layout prop changes while keeping the a11y wiring', () => {
    const { container, rerender } = render(
      <IrisFormField label="Name" labelPlacement="start" labelWidth={100} hint="Help">
        <IrisInput />
      </IrisFormField>,
    )
    const controlId = container.querySelector('input')!.id
    expect(field(container).style.flexDirection).toBe('row')
    expect(label(container).style.width).toBe('100px')

    rerender(
      <IrisFormField label="Name" labelPlacement="start" labelWidth={220} hint="Help">
        <IrisInput />
      </IrisFormField>,
    )
    expect(field(container).style.flexDirection).toBe('row')
    expect(label(container).style.width).toBe('220px')
    expect(container.querySelector('input')!.id).toBe(controlId)
    expect(container.querySelector('input')!.getAttribute('aria-describedby')).toBe(
      container.querySelector('[data-iris-form-field-hint]')!.id,
    )

    // Switching back to the vertical layout drops the control area again and
    // keeps the same label/control wiring.
    rerender(
      <IrisFormField label="Name" labelWidth={220} hint="Help">
        <IrisInput />
      </IrisFormField>,
    )
    expect(field(container).style.flexDirection).toBe('column')
    expect(controlArea(container)).toBeNull()
    expect(container.querySelector('input')!.id).toBe(controlId)
    expect(container.querySelector('input')!.getAttribute('aria-describedby')).toBe(
      container.querySelector('[data-iris-form-field-hint]')!.id,
    )
  })

  it('a consumer style override still wins over the layout defaults', () => {
    const { container } = render(
      <IrisFormField label="Name" labelPlacement="start" style={{ gap: '20px' }}>
        <IrisInput />
      </IrisFormField>,
    )
    expect(field(container).style.gap).toBe('20px')
  })
})
