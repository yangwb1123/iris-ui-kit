import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisFormField } from './FormField'
import { IrisInput } from '../input/Input'

function inputHarness(props: Record<string, unknown>) {
  return defineComponent({
    setup() {
      return () =>
        h(IrisFormField, props, {
          default: () => h(IrisInput, { modelValue: '' }),
        })
    },
  })
}

describe('IrisFormField', () => {
  it('renders the label and links it to the control via for/id', () => {
    const w = mount(inputHarness({ label: 'Email' }))
    const label = w.find('label')
    const input = w.find('input')
    expect(label.exists()).toBe(true)
    expect(label.attributes('for')).toBeTruthy()
    expect(input.attributes('id')).toBe(label.attributes('for'))
  })

  it('required adds a visible asterisk', () => {
    const w = mount(inputHarness({ label: 'Name', required: true }))
    expect(w.find('[data-iris-form-field-required]').exists()).toBe(true)
    expect(w.find('[data-iris-form-field-required]').text()).toBe('*')
  })

  it('renders hint with id wired into aria-describedby', () => {
    const w = mount(inputHarness({ label: 'Field', hint: 'Helpful' }))
    const hint = w.find('[data-iris-form-field-hint]')
    expect(hint.exists()).toBe(true)
    const input = w.find('input')
    expect(input.attributes('aria-describedby')).toBe(hint.attributes('id'))
  })

  it('renders error with role="alert" + flips data-state + aria-invalid', () => {
    const w = mount(inputHarness({ label: 'Field', error: 'Required' }))
    const err = w.find('[data-iris-form-field-error]')
    expect(err.exists()).toBe(true)
    expect(err.attributes('role')).toBe('alert')
    expect(w.attributes('data-iris-form-field-state')).toBe('invalid')
    expect(w.find('input').attributes('aria-invalid')).toBe('true')
  })

  it('hint is hidden when error is present', () => {
    const w = mount(inputHarness({ hint: 'h', error: 'e' }))
    expect(w.find('[data-iris-form-field-hint]').exists()).toBe(false)
    expect(w.find('[data-iris-form-field-error]').exists()).toBe(true)
  })

  it('labelFor overrides the auto-generated id', () => {
    const w = mount(inputHarness({ label: 'Field', labelFor: 'my-custom-id' }))
    const label = w.find('label')
    const input = w.find('input')
    expect(label.attributes('for')).toBe('my-custom-id')
    expect(input.attributes('id')).toBe('my-custom-id')
  })

  it('omits the field label element when no label is given', () => {
    const w = mount(inputHarness({}))
    // The IrisInput itself renders a wrapping <label>; we only care that the
    // FormField's own label (with the for-attribute) isn't there.
    expect(w.find('[data-iris-form-field-label]').exists()).toBe(false)
  })

  it('describedby contains both hint + error ids when both present', () => {
    // Edge: even though hint hides visually when error exists, the IDs we
    // emit reflect the props the consumer passed. (Our component hides the
    // hint visually, but aria-describedby is computed up-front.)
    const w = mount(inputHarness({ hint: 'h', error: 'e' }))
    const describedBy = w.find('input').attributes('aria-describedby')
    // hint id + error id (space-joined)
    expect((describedBy ?? '').split(' ').length).toBe(2)
  })

  it('label color reflects error state', () => {
    const w = mount(inputHarness({ label: 'X', error: 'Required' }))
    expect(w.find('label').attributes('style')).toContain('var(--iris-danger)')
  })
})
