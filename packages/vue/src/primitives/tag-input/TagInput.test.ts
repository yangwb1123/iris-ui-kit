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
})
