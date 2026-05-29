import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisMentions, type IrisMentionOption } from './Mentions'

const OPTS: IrisMentionOption[] = [
  { label: 'Alice', value: 'alice' },
  { label: 'Bob', value: 'bob' },
]

const options = (w: ReturnType<typeof mount>) => w.findAll('[data-iris-mentions-option]')

/** Fire an input event reading the textarea's current value + caret. */
async function typeAt(w: ReturnType<typeof mount>, caret: number) {
  const ta = w.find('textarea')
  ;(ta.element as HTMLTextAreaElement).selectionStart = caret
  await ta.trigger('input')
}

describe('IrisMentions', () => {
  it('opens filtered suggestions when typing the trigger', async () => {
    const w = mount(IrisMentions, { props: { options: OPTS, modelValue: 'Hi @a' } })
    await typeAt(w, 5)
    expect(options(w).length).toBe(1)
    expect(options(w)[0].text()).toBe('Alice')
  })

  it('shows no listbox without an active trigger', async () => {
    const w = mount(IrisMentions, { props: { options: OPTS, modelValue: 'plain text' } })
    await typeAt(w, 10)
    expect(w.find('[data-iris-mentions-listbox]').exists()).toBe(false)
  })

  it('inserts the selected mention into the text', async () => {
    const w = mount(IrisMentions, { props: { options: OPTS, modelValue: 'Hi @a' } })
    await typeAt(w, 5)
    await options(w)[0].trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['Hi @Alice '])
  })

  it('Escape dismisses the listbox', async () => {
    const w = mount(IrisMentions, { props: { options: OPTS, modelValue: '@' } })
    await typeAt(w, 1)
    expect(w.find('[data-iris-mentions-listbox]').exists()).toBe(true)
    await w.find('textarea').trigger('keydown', { key: 'Escape' })
    expect(w.find('[data-iris-mentions-listbox]').exists()).toBe(false)
  })

  it('ArrowDown + Enter selects the active suggestion', async () => {
    const w = mount(IrisMentions, { props: { options: OPTS, modelValue: '@' } })
    await typeAt(w, 1)
    await w.find('textarea').trigger('keydown', { key: 'ArrowDown' })
    await w.find('textarea').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['@Bob '])
  })

  it('a11y: combobox textarea wired to the listbox', async () => {
    const w = mount(IrisMentions, { props: { options: OPTS, modelValue: '@' } })
    const ta = w.find('textarea')
    expect(ta.attributes('role')).toBe('combobox')
    await typeAt(w, 1)
    const listbox = w.find('[role="listbox"]')
    expect(ta.attributes('aria-controls')).toBe(listbox.attributes('id'))
    expect(ta.attributes('aria-expanded')).toBe('true')
  })
})
