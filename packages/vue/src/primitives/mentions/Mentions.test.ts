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

  it('disabled textarea has disabled attribute', () => {
    const w = mount(IrisMentions, { props: { options: OPTS, disabled: true } })
    expect((w.find('textarea').element as HTMLTextAreaElement).disabled).toBe(true)
  })

  it('custom prefix opens suggestions', async () => {
    const w = mount(IrisMentions, { props: { options: OPTS, modelValue: 'use #A', prefix: '#' } })
    await typeAt(w, 6)
    expect(w.find('[data-iris-mentions-listbox]').exists()).toBe(true)
  })

  it('no matching options shows no listbox', async () => {
    const w = mount(IrisMentions, { props: { options: OPTS, modelValue: '@zzz' } })
    await typeAt(w, 5)
    expect(w.find('[data-iris-mentions-listbox]').exists()).toBe(false)
  })

  it('has aria-autocomplete on textarea', () => {
    const w = mount(IrisMentions, { props: { options: OPTS } })
    expect(w.find('textarea').attributes('aria-autocomplete')).toBe('list')
  })

  it('updates aria-activedescendant on navigation', async () => {
    const w = mount(IrisMentions, { props: { options: OPTS, modelValue: '@' } })
    await typeAt(w, 1)
    const ta = w.find('textarea')
    await ta.trigger('keydown', { key: 'ArrowDown' })
    expect(ta.attributes('aria-activedescendant')).toBeTruthy()
  })

  it('handles empty options without crashing', async () => {
    const w = mount(IrisMentions, { props: { options: [], modelValue: '@test' } })
    await typeAt(w, 5)
    expect(w.find('[data-iris-mentions]').exists()).toBe(true)
  })
})

describe('IrisMentions virtual listbox', () => {
  const makeOptions = (n: number): IrisMentionOption[] =>
    Array.from({ length: n }, (_, i) => ({ label: `Item ${i}`, value: `item-${i}` }))
  const spacers = (w: ReturnType<typeof mount>) => w.findAll('[data-iris-mentions-spacer]')
  const listboxEl = (w: ReturnType<typeof mount>) =>
    w.find('[role="listbox"]').element as HTMLElement
  /** Mention listbox rows are a constant 32px estimate (see ROW_HEIGHT). */
  const ROW = 32

  it('A1: virtual off (default) — all options, no spacers', async () => {
    const w = mount(IrisMentions, { props: { options: makeOptions(3), modelValue: '@' } })
    await typeAt(w, 1)
    expect(options(w).length).toBe(3)
    expect(spacers(w).length).toBe(0)
  })

  it('A1: small list with virtual — total window, spacer sum invariant', async () => {
    const w = mount(IrisMentions, {
      props: { options: makeOptions(3), modelValue: '@', virtual: true },
    })
    await typeAt(w, 1)
    expect(options(w).length).toBe(3)
    const sp = spacers(w)
    expect(sp.length).toBe(2)
    const top = sp[0].element as HTMLElement
    const bottom = sp[1].element as HTMLElement
    expect(top.getAttribute('data-iris-mentions-spacer-type')).toBe('top')
    expect(bottom.getAttribute('data-iris-mentions-spacer-type')).toBe('bottom')
    expect(parseFloat(top.style.height)).toBe(0)
    expect(parseFloat(bottom.style.height)).toBe(0)
    expect(
      parseFloat(top.style.height) + options(w).length * ROW + parseFloat(bottom.style.height),
    ).toBe(3 * ROW)
    expect(options(w)[0].attributes('aria-setsize')).toBe('3')
    expect(options(w)[0].attributes('aria-posinset')).toBe('1')
  })

  it('A2: 10k options — windowed render with spacer invariant', async () => {
    const w = mount(IrisMentions, {
      props: { options: makeOptions(10_000), modelValue: '@', virtual: true },
    })
    await typeAt(w, 1)
    const rendered = options(w)
    expect(rendered.length).toBeGreaterThanOrEqual(1)
    expect(rendered.length).toBeLessThanOrEqual(60)
    expect(rendered[0].attributes('id')).toMatch(/-opt-0$/)
    const sp = spacers(w)
    expect(parseFloat((sp[0].element as HTMLElement).style.height)).toBe(0)
    expect(
      parseFloat((sp[0].element as HTMLElement).style.height) +
        rendered.length * ROW +
        parseFloat((sp[1].element as HTMLElement).style.height),
    ).toBe(10_000 * ROW)
  })

  it('A3: ArrowDown across the window edge scrolls (scrollTop === 88)', async () => {
    const w = mount(IrisMentions, {
      props: { options: makeOptions(10_000), modelValue: '@', virtual: true },
    })
    await typeAt(w, 1)
    const ta = w.find('textarea')
    for (let i = 0; i < 8; i++) await ta.trigger('keydown', { key: 'ArrowDown' })
    expect(ta.attributes('aria-activedescendant')).toMatch(/-opt-8$/)
    expect(listboxEl(w).scrollTop).toBe(88)
    const active = w.find(`#${ta.attributes('aria-activedescendant') ?? ''}`)
    expect(active.exists()).toBe(true)
  })

  it('A4: keystroke re-anchors the window to 0 (filtered to 100 matches)', async () => {
    const mixed = [
      ...makeOptions(9_900),
      ...makeOptions(100).map((o, i) => ({ ...o, label: `target-${i}`, value: `target-${i}` })),
    ]
    const w = mount(IrisMentions, {
      props: { options: mixed, modelValue: '@', virtual: true },
    })
    await typeAt(w, 1)
    const lb = listboxEl(w)
    lb.scrollTop = 31_800
    await w.find('[role="listbox"]').trigger('scroll')
    await w.setProps({ modelValue: '@target' })
    await typeAt(w, 7)
    const rendered = options(w)
    expect(rendered[0].attributes('id')).toMatch(/-opt-0$/)
    expect(w.find('textarea').attributes('aria-activedescendant')).toMatch(/-opt-0$/)
    expect(lb.scrollTop).toBe(0)
    const sp = spacers(w)
    expect(parseFloat((sp[0].element as HTMLElement).style.height)).toBe(0)
    expect(
      parseFloat((sp[0].element as HTMLElement).style.height) +
        rendered.length * ROW +
        parseFloat((sp[1].element as HTMLElement).style.height),
    ).toBe(100 * ROW)
  })

  it('A4: external options swap clamps scroll (31,800 → 3,000, first -opt-89)', async () => {
    const w = mount(IrisMentions, {
      props: { options: makeOptions(10_000), modelValue: '@', virtual: true },
    })
    await typeAt(w, 1)
    const lb = listboxEl(w)
    lb.scrollTop = 31_800
    await w.find('[role="listbox"]').trigger('scroll')
    await w.setProps({ options: makeOptions(100) })
    const rendered = options(w)
    expect(rendered[0].attributes('id')).toMatch(/-opt-89$/)
    expect(lb.scrollTop).toBe(3_000)
    const sp = spacers(w)
    const top = sp[0].element as HTMLElement
    const bottom = sp[1].element as HTMLElement
    expect(parseFloat(bottom.style.height)).toBe(0)
    expect(
      parseFloat(top.style.height) + rendered.length * ROW + parseFloat(bottom.style.height),
    ).toBe(100 * ROW)
  })
})
