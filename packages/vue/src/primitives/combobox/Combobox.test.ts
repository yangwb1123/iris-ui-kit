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
const spacers = (w: ReturnType<typeof mount>) => w.findAll('[data-iris-combobox-spacer]')
const listbox = (w: ReturnType<typeof mount>) => w.find('[role="listbox"]')
const makeOptions = (n: number): IrisComboboxOption[] =>
  Array.from({ length: n }, (_, i) => ({ label: `Item ${i}`, value: `item-${i}` }))

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
    expect(w.find('[data-iris-combobox-empty]').text()).toBe('No matching results')
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

  it('keyboard: ArrowUp + Enter selects the previous option', async () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS } })
    const el = input(w)
    await el.trigger('focus')
    await el.trigger('keydown', { key: 'ArrowDown' })
    await el.trigger('keydown', { key: 'ArrowDown' })
    await el.trigger('keydown', { key: 'ArrowUp' })
    await el.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['apple'])
  })

  it('keyboard: ArrowUp from a closed/unset state moves to the first option', async () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS } })
    const el = input(w)
    await el.trigger('focus')
    await el.trigger('keydown', { key: 'ArrowUp' })
    await el.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['apple'])
  })

  it('allowCommit: Enter with unmatched free text emits commit (not modelValue)', async () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS, allowCommit: true } })
    const el = input(w)
    await el.trigger('focus')
    await el.setValue('Mango')
    await el.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('commit')?.[0]).toEqual(['Mango'])
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('allowCommit: blur with unmatched free text commits it', async () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS, allowCommit: true } })
    const el = input(w)
    await el.trigger('focus')
    await el.setValue('  Mango  ')
    await el.trigger('blur')
    expect(w.emitted('commit')?.[0]).toEqual(['Mango'])
  })

  it('allowCommit: matching option still selects it (commit not emitted)', async () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS, allowCommit: true } })
    const el = input(w)
    await el.trigger('focus')
    await el.setValue('Ba')
    await opts(w)[0].trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['banana'])
    expect(w.emitted('commit')).toBeUndefined()
  })

  it('allowCommit: blank query does not emit commit on blur', async () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS, allowCommit: true } })
    const el = input(w)
    await el.trigger('focus')
    await el.setValue('   ')
    await el.trigger('blur')
    expect(w.emitted('commit')).toBeUndefined()
  })

  it('default (no allowCommit): Enter with unmatched text emits nothing', async () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS } })
    const el = input(w)
    await el.trigger('focus')
    await el.setValue('Mango')
    await el.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('commit')).toBeUndefined()
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})

describe('IrisCombobox virtual listbox', () => {
  it('A1: virtual off (default) — all options, no spacers', async () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS } })
    await input(w).trigger('focus')
    expect(opts(w).length).toBe(3)
    expect(spacers(w).length).toBe(0)
  })

  it('A1: small list with virtual — total window, spacer sum invariant', async () => {
    const w = mount(IrisCombobox, { props: { options: OPTIONS, virtual: true } })
    await input(w).trigger('focus')
    expect(opts(w).length).toBe(3)
    const sp = spacers(w)
    expect(sp.length).toBe(2)
    const top = sp[0].element as HTMLElement
    const bottom = sp[1].element as HTMLElement
    expect(top.getAttribute('data-iris-combobox-spacer-type')).toBe('top')
    expect(bottom.getAttribute('data-iris-combobox-spacer-type')).toBe('bottom')
    expect(
      parseFloat(top.style.height) + opts(w).length * 34 + parseFloat(bottom.style.height),
    ).toBe(3 * 34)
    expect(opts(w)[0].attributes('aria-setsize')).toBe('3')
    expect(opts(w)[0].attributes('aria-posinset')).toBe('1')
  })

  it('A2 smoke: 10k options — windowed render with spacer invariant', async () => {
    const w = mount(IrisCombobox, { props: { options: makeOptions(10_000), virtual: true } })
    await input(w).trigger('focus')
    const rendered = opts(w)
    expect(rendered.length).toBeGreaterThanOrEqual(1)
    expect(rendered.length).toBeLessThanOrEqual(50)
    expect(rendered[0].attributes('id')).toMatch(/-opt-0$/)
    const sp = spacers(w)
    expect(parseFloat((sp[0].element as HTMLElement).style.height)).toBe(0)
    expect(
      parseFloat((sp[0].element as HTMLElement).style.height) +
        rendered.length * 34 +
        parseFloat((sp[1].element as HTMLElement).style.height),
    ).toBe(10_000 * 34)
  })

  it('A3 smoke: End scrolls the last option into view (maxScroll)', async () => {
    const w = mount(IrisCombobox, { props: { options: makeOptions(10_000), virtual: true } })
    const el = input(w)
    await el.trigger('focus')
    await el.trigger('keydown', { key: 'End' })
    expect(el.attributes('aria-activedescendant')).toMatch(/-opt-9999$/)
    const lb = listbox(w).element as HTMLElement
    expect(lb.scrollTop).toBe(339_760)
    const active = w.find(`#${el.attributes('aria-activedescendant') ?? ''}`)
    expect(active.exists()).toBe(true)
  })
})
