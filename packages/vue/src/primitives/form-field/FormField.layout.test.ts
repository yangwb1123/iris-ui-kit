import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisFormField } from './FormField'
import { IrisInput } from '../input/Input'

function harness(props: Record<string, unknown>) {
  return defineComponent({
    setup() {
      return () =>
        h(IrisFormField, props, {
          default: () => h(IrisInput, { modelValue: '' }),
        })
    },
  })
}

/** Layout props are reactive — changing one must restyle the live field. */
function reactiveHarness(initial: Record<string, unknown>) {
  return defineComponent({
    setup() {
      const props = ref(initial)
      return { props }
    },
    render() {
      return h(IrisFormField, this.props, { default: () => h(IrisInput, { modelValue: '' }) })
    },
  })
}

describe('IrisFormField layout props', () => {
  it('keeps the default field vertical and ungrouped', () => {
    const w = mount(harness({ label: 'Name', hint: 'Help' }))
    expect(w.attributes('style')).toContain('flex-direction: column')
    expect(w.attributes('style')).not.toContain('box-sizing')
    expect(w.find('[data-iris-form-field-control]').exists()).toBe(false)
    expect(w.attributes('data-iris-form-field-placement')).toBeUndefined()
  })

  it('labelPlacement="start" renders a shrinkable row with a control column', () => {
    const w = mount(harness({ label: 'Name', labelPlacement: 'start' }))
    expect(w.attributes('style')).toContain('flex-direction: row')
    expect(w.attributes('data-iris-form-field-placement')).toBe('start')
    expect(w.attributes('style')).toContain('box-sizing: border-box')
    expect(w.attributes('style')).toContain('min-width: 0')

    const labelStyle = w.find('label').attributes('style')
    expect(labelStyle).toContain('flex: 0 1 auto')
    expect(labelStyle).toContain('overflow-wrap: anywhere')

    const area = w.find('[data-iris-form-field-control]')
    expect(area.exists()).toBe(true)
    expect(area.attributes('style')).toContain('flex: 1 1 0')
    expect(area.attributes('style')).toContain('min-width: 0')
    expect(area.find('input').exists()).toBe(true)
  })

  it('groups hint/error under the control in a horizontal field', () => {
    const w = mount(
      harness({ label: 'Email', labelPlacement: 'start', hint: 'Work', error: 'Required' }),
    )
    const area = w.find('[data-iris-form-field-control]')
    // error replaces the hint, as always
    expect(area.find('[data-iris-form-field-hint]').exists()).toBe(false)
    const err = area.find('[data-iris-form-field-error]')
    expect(err.attributes('role')).toBe('alert')
    expect(w.find('label').element.contains(err.element)).toBe(false)
    expect(w.find('input').attributes('aria-describedby')).toBe(err.attributes('id'))
    expect(w.find('input').attributes('aria-invalid')).toBe('true')
  })

  it('labelWidth accepts px numbers and CSS lengths', () => {
    const px = mount(harness({ label: 'Name', labelPlacement: 'start', labelWidth: 140 }))
    expect(px.find('label').attributes('style')).toContain('width: 140px')
    const rem = mount(harness({ label: 'Name', labelPlacement: 'start', labelWidth: '8rem' }))
    expect(rem.find('label').attributes('style')).toContain('width: 8rem')
  })

  it('controlWidth sizes the control column and can still shrink', () => {
    const w = mount(harness({ label: 'Name', labelPlacement: 'start', controlWidth: '20rem' }))
    const area = w.find('[data-iris-form-field-control]')
    expect(area.attributes('style')).toContain('width: 20rem')
    expect(area.attributes('style')).toContain('flex: 0 1 auto')
    expect(area.attributes('style')).toContain('max-width: 100%')
  })

  it('fullWidth stretches the field', () => {
    const w = mount(harness({ label: 'Name', fullWidth: true }))
    expect(w.attributes('style')).toContain('width: 100%')
    expect(w.find('[data-iris-form-field-control]').exists()).toBe(true)
  })

  it('rejects invalid dimensions', () => {
    const w = mount(
      harness({ label: 'Name', labelWidth: Number.NaN, controlWidth: -8, fullWidth: true }),
    )
    expect(w.find('label').element.style.width).toBe('')
    expect(w.attributes('style')).toContain('width: 100%')
  })

  it('keeps a real for/id link + required marker in a horizontal field', () => {
    const w = mount(
      harness({
        label: 'Email',
        labelPlacement: 'start',
        required: true,
        labelFor: 'mail',
      }),
    )
    const label = w.find('label')
    expect(label.attributes('for')).toBe('mail')
    expect(w.find('input').attributes('id')).toBe('mail')
    expect(w.find('[data-iris-form-field-required]').text()).toBe('*')
    // no nested label around the control's own label wrapper
    expect(w.element.querySelectorAll('label label')).toHaveLength(0)
  })

  it('reacts to layout prop changes', async () => {
    const w = mount(reactiveHarness({ label: 'Name', labelPlacement: 'start', labelWidth: 100 }))
    expect(w.attributes('style')).toContain('flex-direction: row')
    expect(w.find('label').attributes('style')).toContain('width: 100px')

    ;(w.vm as unknown as { props: Record<string, unknown> }).props.labelWidth = 240
    await nextTick()
    expect(w.find('label').attributes('style')).toContain('width: 240px')

    delete (w.vm as unknown as { props: Record<string, unknown> }).props.labelPlacement
    await nextTick()
    expect(w.attributes('style')).toContain('flex-direction: column')
    expect(w.find('[data-iris-form-field-control]').exists()).toBe(false)
    expect(w.find('input').attributes('id')).toBe(w.find('label').attributes('for'))
  })
})
