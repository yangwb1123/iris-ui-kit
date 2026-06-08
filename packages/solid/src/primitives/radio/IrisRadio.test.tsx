import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisRadioGroup, IrisRadio } from './IrisRadio'

afterEach(cleanup)

describe('IrisRadio', () => {
  it('renders radio group', () => {
    const { container } = render(() => (
      <IrisRadioGroup>
        <IrisRadio value="a">Option A</IrisRadio>
        <IrisRadio value="b">Option B</IrisRadio>
      </IrisRadioGroup>
    ))
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-iris-radio]').length).toBe(2)
  })

  it('marks selected radio as checked', () => {
    const { container } = render(() => (
      <IrisRadioGroup value="b">
        <IrisRadio value="a">A</IrisRadio>
        <IrisRadio value="b">B</IrisRadio>
      </IrisRadioGroup>
    ))
    const radios = container.querySelectorAll('[data-iris-radio]')
    expect(radios[0].getAttribute('data-state')).toBe('unchecked')
    expect(radios[1].getAttribute('data-state')).toBe('checked')
  })

  it('fires onChange when radio is selected', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisRadioGroup onChange={onChange}>
        <IrisRadio value="x">X</IrisRadio>
      </IrisRadioGroup>
    ))
    const input = container.querySelector('input')!
    fireEvent.click(input)
    expect(onChange).toHaveBeenCalledWith('x')
  })
})
