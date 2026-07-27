import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisTagInput } from './TagInput'

const tags = (w: ReturnType<typeof mount>) => w.findAll('[data-iris-tag-input-tag]')
const removes = (w: ReturnType<typeof mount>) => w.findAll('[data-iris-tag-input-remove]')

describe('IrisTagInput', () => {
  it('renders existing tags', () => {
    const w = mount(IrisTagInput, { props: { modelValue: ['a', 'b'] } })
    expect(tags(w).length).toBe(2)
  })

  it('Enter commits a tag', async () => {
    const w = mount(IrisTagInput)
    await w.find('input').setValue('foo')
    await w.find('input').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([['foo']])
  })

  it('a comma commits a tag', async () => {
    const w = mount(IrisTagInput)
    await w.find('input').setValue('foo,')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([['foo']])
  })

  it('Backspace on an empty field removes the last tag', async () => {
    const w = mount(IrisTagInput, { props: { modelValue: ['a', 'b'] } })
    await w.find('input').trigger('keydown', { key: 'Backspace' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([['a']])
  })

  it('the remove button removes its tag', async () => {
    const w = mount(IrisTagInput, { props: { modelValue: ['a', 'b'] } })
    await removes(w)[0].trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([['b']])
  })

  it('prevents duplicates by default', async () => {
    const w = mount(IrisTagInput, { props: { modelValue: ['foo'] } })
    await w.find('input').setValue('foo')
    await w.find('input').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('enforces max', async () => {
    const w = mount(IrisTagInput, { props: { modelValue: ['a'], max: 1 } })
    await w.find('input').setValue('b')
    await w.find('input').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('a11y: remove buttons are labelled', () => {
    const w = mount(IrisTagInput, { props: { modelValue: ['foo'] } })
    expect(removes(w)[0].attributes('aria-label')).toBe('Remove foo')
  })

  it('trims committed text and clears the field', async () => {
    const w = mount(IrisTagInput)
    const input = w.find('input')

    await input.setValue('  release  ')
    await input.trigger('keydown', { key: 'Enter' })

    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([['release']])
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('commits a pasted comma list, removes duplicates, and keeps the suffix', async () => {
    const w = mount(IrisTagInput, { props: { modelValue: ['stable'] } })
    const input = w.find('input')

    await input.setValue(' alpha, stable, beta, unfinished')

    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([['stable', 'alpha', 'beta']])
    expect((input.element as HTMLInputElement).value).toBe(' unfinished')
  })

  it('allows duplicate tags when requested', async () => {
    const w = mount(IrisTagInput, {
      props: { modelValue: ['same'], allowDuplicates: true },
    })
    const input = w.find('input')

    await input.setValue('same')
    await input.trigger('keydown', { key: 'Enter' })

    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([['same', 'same']])
  })

  it('applies max across all entries in a pasted list', async () => {
    const w = mount(IrisTagInput, {
      props: { modelValue: ['one'], max: 3 },
    })

    await w.find('input').setValue('two, three, four,')

    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([['one', 'two', 'three']])
  })

  it('reacts to controlled modelValue updates', async () => {
    const w = mount(IrisTagInput, { props: { modelValue: ['first'] } })
    expect(tags(w).map((tag) => tag.attributes('data-value'))).toEqual(['first'])

    await w.setProps({ modelValue: ['second', 'third'] })

    expect(tags(w).map((tag) => tag.attributes('data-value'))).toEqual(['second', 'third'])
  })

  it('disables the field and every remove action', async () => {
    const w = mount(IrisTagInput, {
      props: { modelValue: ['locked'], disabled: true },
    })
    const input = w.find('input')

    expect((input.element as HTMLInputElement).disabled).toBe(true)
    expect(removes(w)[0].attributes()).toHaveProperty('disabled')
    await removes(w)[0].trigger('click')
    await input.trigger('keydown', { key: 'Backspace' })
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('exposes invalid and form-description attributes', () => {
    const w = mount(IrisTagInput, {
      props: {
        invalid: true,
        id: 'labels',
        ariaDescribedby: 'labels-error',
      },
    })
    const root = w.find('[data-iris-tag-input]')
    const input = w.find('input')

    expect(root.attributes('data-state')).toBe('invalid')
    expect(input.attributes('id')).toBe('labels')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe('labels-error')
  })

  it('tracks focus when valid and keeps invalid state authoritative', async () => {
    const valid = mount(IrisTagInput)
    await valid.find('input').trigger('focus')
    expect(valid.find('[data-iris-tag-input]').attributes('data-state')).toBe('focused')
    await valid.find('input').trigger('blur')
    expect(valid.find('[data-iris-tag-input]').attributes('data-state')).toBe('idle')

    const invalid = mount(IrisTagInput, { props: { invalid: true } })
    await invalid.find('input').trigger('focus')
    expect(invalid.find('[data-iris-tag-input]').attributes('data-state')).toBe('invalid')
  })

  it('shows placeholder only while there are no tags', async () => {
    const w = mount(IrisTagInput, {
      props: { placeholder: 'Add label', modelValue: [] },
    })
    expect(w.find('input').attributes('placeholder')).toBe('Add label')

    await w.setProps({ modelValue: ['present'] })

    expect(w.find('input').attributes('placeholder')).toBeUndefined()
  })

  it('forwards root attrs and merges caller style last', () => {
    const w = mount(IrisTagInput, {
      attrs: {
        class: 'custom-root',
        'data-owner': 'settings',
        style: { padding: '20px', marginTop: '12px' },
      },
    })
    const root = w.find('[data-iris-tag-input]')

    expect(root.classes()).toContain('custom-root')
    expect(root.attributes('data-owner')).toBe('settings')
    expect((root.element as HTMLElement).style.padding).toBe('20px')
    expect((root.element as HTMLElement).style.marginTop).toBe('12px')
  })
})
