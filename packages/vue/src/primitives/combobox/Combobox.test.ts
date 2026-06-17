import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisCombobox, type IrisComboboxOption } from './Combobox'

const OPTIONS: IrisComboboxOption[] = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
]

const input = (w: ReturnType<typeof mount>) => w.find('[data-iris-combobox-input]')
const opts = (w: ReturnType<typeof mount>) => w.findAll('[data-iris-combobox-option]')

describe('IrisCombobox', () => {
  it('renders a combobox input, closed initially', () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS } })
    expect(input(w).attributes('role')).toBe('combobox')
    expect(input(w).attributes('aria-expanded')).toBe('false')
  })

  it('opens on focus and lists all options', async () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS } })
    await input(w).trigger('focus')
    expect(input(w).attributes('aria-expanded')).toBe('true')
    expect(opts(w).length).toBe(3)
  })

  it('filters options as you type', async () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS } })
    await input(w).trigger('focus')
    await input(w).setValue('Ba')
    expect(opts(w).length).toBe(1)
    expect(opts(w)[0].text()).toBe('Banana')
  })

  it('clicking an option emits its value', async () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS } })
    await input(w).trigger('focus')
    await opts(w)[1].trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['banana'])
  })

  it('keyboard: ArrowDown + Enter selects the active option', async () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS } })
    const el = input(w)
    await el.trigger('focus')
    await el.trigger('keydown', { key: 'ArrowDown' })
    await el.trigger('keydown', { key: 'ArrowDown' })
    await el.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['banana'])
  })

  it('Escape closes the listbox', async () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS } })
    await input(w).trigger('focus')
    expect(input(w).attributes('aria-expanded')).toBe('true')
    await input(w).trigger('keydown', { key: 'Escape' })
    expect(input(w).attributes('aria-expanded')).toBe('false')
  })

  it('shows empty text when nothing matches', async () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS } })
    await input(w).trigger('focus')
    await input(w).setValue('zzz')
    expect(opts(w).length).toBe(0)
    expect(w.find('[data-iris-combobox-empty]').text()).toBe('No results')
  })

  it('reflects the selected value as the input text (v-model)', () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS, modelValue: 'cherry' } })
    expect((input(w).element as HTMLInputElement).value).toBe('Cherry')
  })

  it('marks the selected option with aria-selected', async () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS, modelValue: 'banana' } })
    await input(w).trigger('focus')
    const selected = opts(w).find((o) => o.attributes('aria-selected') === 'true')
    expect(selected?.text()).toBe('Banana')
  })

  it('disabled does not open', async () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS, disabled: true } })
    await input(w).trigger('focus')
    expect(input(w).attributes('aria-expanded')).toBe('false')
  })

  it('a11y: aria-controls points at the listbox', async () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS, id: 'cb' } })
    const el = input(w)
    expect(el.attributes('id')).toBe('cb')
    await el.trigger('focus')
    const listbox = w.find('[role="listbox"]')
    expect(listbox.attributes('id')).toBe(el.attributes('aria-controls'))
  })
})
